'use strict'
const mpd = require('mpd-api')

const { 
  from,
  of,
  Observable,
  combineLatest,
  bindNodeCallback 
} = require('rxjs')

const {
  toArray,
  map,
  distinct,
  reduce,
  tap,
  mergeMap,
  filter,
  distinctUntilChanged,
  debounceTime,
  share
} = require('rxjs/operators')

const null$ = of(null)

exports.connect = connConfig => mpd
  .connect(connConfig)
  .then(client => {
    const streams = handle(client)

    const mpd$ = combineLatest(
      streams.status$,
      streams.song$,
      streams.urlHandlers$,
      streams.mimeTypes$
    )
    .pipe(
      map(([status, song, urlHandlers, mimeTypes]) =>
        ({ status, song, urlHandlers, mimeTypes })),
      share()
    )

    return {
      ...streams,
      mpd$,
      client
    }

  })

const handle = client => {
  // get the status when needed
  const status$ = getClientStream(client)
    .pipe(
      map(evt => evt.type === 'initial' ? 'initial' : evt.evt),
      filter(evt => ~['initial', 'player', 'options', 'mixer'].indexOf(evt)),
      debounceTime(32),
      mergeMap(() => client.api.status.get()),
      share()
    )

  // current song info
  const song$ = status$.pipe(
    map(status => status.songid),
    distinctUntilChanged(),
    tap(songid => console.verbose('[mpdclient] song changed %s', songid)),
    mergeMap(songid => songid == null ? null$ : client.api.queue.id(songid)),
    map(song => song instanceof Array ? song[0] : song),
    share()
  )

  const urlHandlers$ = from(client.api.reflection.urlhandlers())
  .pipe(
    map(handlers => handlers.map(handler => handler.replace('://', ''))),
    share()
  )


  const mimeTypes$ = from(client.api.reflection.decoders()).pipe(
    mergeMap(decoder => decoder),
    map(decoder => decoder.mime_type || []), // some decoders have none
    toArray(),
    // some current result: [ [mt1, mt2], [], 'mime_type', [mt1, ..]]
    // flattening will handle string values and empty arrays correctly
    map(arr => arr.flat().sort()),
    // split array into single values again
    mergeMap(arr => arr),
    // and just keep distinct values (works since they are sorted)
    distinct(),
    toArray(),
    share()
  )

  return { status$, song$, urlHandlers$, mimeTypes$ }
}

const getClientStream = client => Observable.create(observer => {
  const onEnd = () => {
    console.verbose('[mpdclient] client connection lost')
    observer.complete()
  }

  const onErr = err => {
    observer.next({ type: 'error', err })
  }

  const onEvt = evt => {
    observer.next({ type: 'system', evt })
  }

  client.on('close', onEnd)
  client.on('error', onErr)
  client.on('system', onEvt)

  observer.next({ type: 'initial' })

  return () => {
    client.removeListener('system', onEvt)
    client.removeListener('end', onEnd)
    client.removeListener('error', onErr)
  }
})
