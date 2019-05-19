'use strict'
const mpd = require('mpd-api')
const cmd = mpd.mpd.cmd

const {
  catchError,
  mergeMap,
  withLatestFrom,
  filter
} = require('rxjs/operators')

exports.handle = (status$, event$, client) => {
  const handler = getHandler(client)
  event$
    .pipe(withLatestFrom(status$))
    .subscribe((...args) => {
      handler.apply(null, args).catch(err => {
        console.verbose('[mprisevt] handle evt error', err)
      })
    })
}

const getHandler = client => async (
  [{ evt, args }, { state, playlistlength, song }]) => {
  console.verbose('[mprisevt] got event', evt)

  switch (evt) {
    case 'volume':
      const volume = parseFloat(args[0])
      if (isNaN(volume)) {
        return console.verbose('[mprisevt] invalid volume %s', args[0])
      }
      return client.api.playback.setvol(
        Math.max(0, Math.min(100, Math.floor(volume * 100)))
      )
    case 'shuffle':
      const random = args[0]
      return client.api.playback.random(!!random)
    case 'seek':
      const pos = parseFloat(args[0] / 1000 / 1000)
      if (isNaN(pos)) {
        return console.verbose('[mprisevt] invalid seek position %s', pos)
      }
      const offset = (pos > 0 ? '+' : '') + pos
      return client.api.playback.seekcur(offset)
    case 'position':
      const position = parseFloat(args[0].position / 1000 / 1000)
        if (isNaN(position)) {
          return console.verbose('[mprisevt] invalid position %s', position)
        }
      return client.api.playback.seekcur(position)
    case 'open':
      const uri = args[0].uri
      if (!uri) {
        return console.verbose('[mprisevt] invalid open uri %s', uri)
      }
      let songuri = uri
        .replace(/^file:\/\//, '')
        .replace(/%20/g, ' ')

      const newid = await client.api.queue.addid(songuri)
      if (state !== 'play') {
        return client.api.playback.playid(newid)
      }
      break
    case 'loopStatus':
      const mode = args[0]
      if (typeof mode !== 'string') {
        return console.verbose('[mprisevt] invalid loop mode %s', mode)
      }
      switch (mode.toLowerCase()) {
        case 'none':
          return client.api.playback.repeat(false)
        case 'track':
          return client.sendCommands([ cmd('repeat', 1), cmd('single', 1) ])
        case 'playlist':
          return client.sendCommands([ cmd('repeat', 1), cmd('single', 0) ])
        default:
          return console.verbose('[mprisevt] invalid loop mode %s', mode)
      }
    case 'next':
      return state === 'stop' ? null : client.api.playback.next()
    case 'previous':
      return state === 'stop' ? null : client.api.playback.prev()
    case 'stop':
      return client.api.playback.stop()
    case 'pause':
      if (state !== 'play') {
        return
      }
    /* falls through */
    case 'playpause':
    // pause the playback
    // or continue the same as if `play` was emitted
      if (state === 'play') {
        return client.api.playback.pause()
      }
    /* falls through */
    default:
      if (evt === 'pause' || evt === 'playpause' || evt === 'play') {
        switch (state) {
          case 'pause':
            return client.api.playback.resume()
          case 'stop':
            if (playlistlength === '0') {
              console.verbose('[mprisevt] play called, but queue empty')
              return
            }
            return client.api.playback.play(song | 0)
        }
      }
  }


}

exports.handleOld = (client, status$, event$) => {
  console.verbose('[mprisevt] handling events')

  const cmd = callMPD(client)
  const mcmd = callMPDMulti(client)

  // handle simple events
  //event$
  //  .pipe(filter(doFilter(Object.keys(MPD_CMD_SIMPLE))))
  //  .subscribe(({ evt }) => cmd(MPD_CMD_SIMPLE[evt]))

  //event$
  //  .pipe(filter(doFilter('volume')))
  //  .subscribe(({ args: [volume] }) => {
  //    volume = parseFloat(volume)
  //    if (isNaN(volume)) {
  //      return console.verbose('[mprisevt] invalid volume')
  //    }
  //    cmd(mpd.cmd('setvol', [Math.max(0, Math.min(100, Math.floor(volume * 100)))]))
  //  })

  //event$
  //  .pipe(filter(doFilter(['play', 'playpause'])))
  //  .pipe(withLatestFrom(status$))
  //  .subscribe(([{ evt }, { state, playlistlength, song }]) => {
  //    switch (evt) {
  //      case 'playpause':
  //      // pause the playback
  //      // or continue the same as if `play` was emitted
  //        if (state === 'play') {
  //          return cmd(mpd.cmd('pause', [1]))
  //        }
  //      /* falls through */
  //      default:
  //        switch (state) {
  //          case 'pause':
  //            return cmd(mpd.cmd('pause', [0]))
  //          case 'stop':
  //            if (playlistlength === '0') {
  //              console.verbose('[mprisevt2mpd] play called, but queue empty')
  //              return
  //            }
  //            return cmd(mpd.cmd('play', [song | 0]))
  //        }
  //    }
  //  })
}

const doFilter = evtName => e => evtName instanceof Array
  ? !!~evtName.indexOf(e.evt)
  : e.evt === evtName

const callMPD = client => (...args) => {
  console.verbose('[mprisevt]  => %O', args)
  client.sendCommand(args, mpdErrLog)
}

const callMPDMulti = client => (args) => {
  console.verbose('[mprisevt]  => %O', args)
  client.sendCommands(args, mpdErrLog)
}

const mpdErrLog = err => {
  if (err) {
    console.error('[mprisevt] error on command', err)
  }
}
