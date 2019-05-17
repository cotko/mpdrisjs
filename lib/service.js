'use strict'
const { from, of } = require('rxjs')
const { reduce, filter, switchMap, tap, map ,mergeMap } = require('rxjs/operators')

const mpdclient = require('./mpdclient')
const mpris = require('./mpris')
const mprisevt = require('./mprisevt')
const art = require('./art')

exports.start = async (config) => {
  console.verbose('[svc] staring')

  const { client, mpd$, status$, song$ } = await mpdclient.connect(
    config.connection)

  console.log('[svc] connected to MPD')

  const art$ = await art.initialize(config.art,
    config.music_dir, song$, client)

  mpris.handle(mpd$, status$, art$, config.music_dir)
  mprisevt.handle(status$, mpris.event$, client, config.music_dir)

  mpd$.subscribe(undefined, undefined, () => {
    console.log('client connection lost.')
    process.exit()
  })

  console.log('[svc] running')
}
