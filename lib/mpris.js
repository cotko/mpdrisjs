'use strict'
const mpris = require('mpris-service')
const path = require('path')
const { Subject } = require('rxjs')
const { map, distinctUntilChanged } = require('rxjs/operators')


let Player

// static getPosition() method is needed for the mpris player
// which needs to return instantly
const positionHandler = (() => {

  const DELAY_SEEKED = 500
  let INITIAL_SEEKED = false
  let LAST_TIME
  let LAST_POSITION = 0
  let updateTimeout

  const updateSeeked = () => {
    clearTimeout(updateTimeout)
    updateTimeout = setTimeout(() => {
      if (!Player) {
        return
      }
      Player.seeked(getPosition() + (DELAY_SEEKED * 1000))
    }, DELAY_SEEKED)
  }

  const handleStatus = status$ => status$
      .pipe(
        map(status => status ? status.elapsed : null),
        distinctUntilChanged()
      )
      .subscribe(elapsed => {
        LAST_TIME = Date.now()
        LAST_POSITION = elapsed != null
          ? (elapsed * 1000 * 1000) // micro seconds
          : 0

        // if seeking, we need to update the player as well
        updateSeeked()

      })

    const getPosition = () => LAST_TIME
      ? LAST_POSITION + ((Date.now() - LAST_TIME) * 1000)
      : 0

  return { handleStatus, getPosition }

})()

const assureFloat = num => isNaN(Number(num)) ? 0 : num
const firstNonEmpty = arr => arr.map(s => s || '').filter(s => s.length)[0]

const MPD_STATE_2_STATUS = {
  play: 'Playing',
  pause: 'Paused',
  stop: 'Stopped'
}

const MPD_SONG_META = {
  albumartist: 'xesam:albumArtist',
  album: 'xesam:album',
  comment: 'xesam:comment',
  composer: 'xesam:composer',
  genre: 'xesam:genre',
  disc: 'xesam:discNumber',
  track: 'xesam:track',
  bitrate: 'xesam:audioBPM',
}

const PLAYER_EVENTS = [
  /* 'raise', 'quit', */ 'next', 'previous', 'pause',
  'playpause', 'stop', 'play', 'seek', 'position',
  'open', 'volume', 'loopStatus', 'shuffle'
]

exports.event$ = new Subject()

exports.handle = (mpd$, status$, art$, musicDir) => {
  console.verbose('[mpris] handling MPD')

  positionHandler.handleStatus(status$)

  mpd$.subscribe(({ status, song, urlHandlers, mimeTypes }) => {
    preparePlayer(urlHandlers, mimeTypes)
    updatePlayerState(status, song, musicDir)
  })

  art$.subscribe(updatePlayerArt)
}

const updatePlayerState = (status, song, musicDir) => {

  Player.playbackStatus = MPD_STATE_2_STATUS[status.state]
  Player.shuffle = !!status.random
  Player.loopStatus = status.repeat
    ? status.single // || status.single === 'oneshot'
      ? 'Track'
      : 'Playlist'
    : 'None'

  if (status.volume !== undefined) {
    Player.volume = Math.max(0, Math.min(1, status.volume / 100))
  }

  let meta = {}
  if (song) {
    meta = {
      'mpris:trackid': Player.objectPath(`track/${song.id}`),
      'mpris:length': Math.floor(
        // In microseconds
        assureFloat(status.duration) * 1000 * 1000
      ),
      'xesam:title': firstNonEmpty([song.title, path.parse(song.file).name])
    }

    // do not override the current art url, it's
    // handeled separately
    if (Player.metadata['mpris:artUrl']) {
      meta['mpris:artUrl'] = Player.metadata['mpris:artUrl']
    }

    const url = song.file
    meta['xesam:url'] = url.indexOf('://') !== -1
      ? url
      : 'file://' + path.join(musicDir, url)

    const artist = firstNonEmpty([
      song.artist, song.albumartist
    ])

    if (artist) {
      meta['xesam:artist'] = [artist]
    }

    for (let key in MPD_SONG_META) {
      let val = song[key]
      if (val === undefined) {
        continue
      }
      meta[MPD_SONG_META[key]] = val
    }
  }

  Player.metadata = meta

  //let keys = [
  //  'playbackStatus', 'loopStatus', 'shuffle', 'volume', 'metadata'
  //]
  //for (let key of keys) {
  //  console.log('[%s]', key, Player[key])
  //}

  // Player.rate
  // Player.minimumRate
  // Player.maximumRate

}

const updatePlayerArt = (url) => {
  if (!Player) {
    return
  }
  console.verbose('[mpris] updating art %O', url)
  const meta = { ...Player.metadata }
  meta['mpris:artUrl'] = url
  Player.metadata = meta
}

const preparePlayer = (urlHandlers, mimeTypes) => {
  if (Player) {
    return
  }

  console.verbose('[mpris] preparing the player')

  Player = mpris({
    name: 'MPD',
    identity: 'MPD daemon',
    supportedUriSchemes: urlHandlers,
    supportedMimeTypes: mimeTypes,
    supportedIterfaces: ['player']
  })

  Player.canControl = true
  Player.canGoNext = true
  Player.canGoPrevious = true
  Player.canPlay = true
  Player.canPause = true
  Player.canSeek = true

  Player.on('quit', () => {
    console.verbose('[mpris] should quit')
  })

  Player.getPosition = positionHandler.getPosition

  // forward events to the event$ stream
  for (let evt of PLAYER_EVENTS) {
    Player.on(evt, (...args) => {
      console.verbose('[mpris] got event %O, args: %O', evt, args)
      exports.event$.next({ evt, args })
    })
  }
}

