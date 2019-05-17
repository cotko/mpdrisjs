'use strict'
const path = require('path')
const { readFile, isFile } = require('./util')
const http = require('http')
const naddress = require('network-address')
const extract = require('./extract')
const scanfolder = require('./scanfolder')
const mpdArt = require('./mpd')

const { of, from } = require('rxjs')
const {
  share,
  tap,
  switchMap,
  mergeMap,
  distinctUntilChanged,
  map
} = require('rxjs/operators')

const CACHED = {}
const SERVER_IP = naddress()

let DEFAULT_ART = path.join(__dirname, 'mpd.png')
let SERVER_PORT

exports.initialize = async (config, musicDir, song$, client) => {
  // if diabled allthogether
  if (config === false) {
    return of(null)
  }

  await startCoverServer()

  await applyArtConfig(config)

  return artStream(musicDir, song$, client)
}

const applyArtConfig = async config => {
  if (typeof config === 'object') {
    // fallback image
    if (config.fallback === false) {
      DEFAULT_ART = null
      console.verbose('[art config] disabling fallback cover art')
    } else if (typeof config.fallback === 'string') {
      // check if file exists
      let fallback = await isFile(config.fallback)
      if (fallback) {
        console.verbose('[art config] setting fallback to %s', fallback)
        DEFAULT_ART = fallback
      } else {
        console.verbose(
          '[art config] invalid cover fallback to %s', config.fallback)
      }
    }

    // embedded art
    if (config.embedded === false) {
      console.verbose('[art config] disabling embedded cover art')
      extract.enable(false)
    }

    if (config.dir === false) {
      console.verbose('[art config] disabling scanning song dir for cover art')
      scanfolder.enable(false)
    } else if (config.dir instanceof Array) {
      scanfolder.setFilters(config.dir.filter(f =>
        typeof f === 'string' ||
        (typeof f === 'object' && typeof f.test === 'function')))
    }

    if (config.frommpd === false) {
      console.verbose('[art config] disabling mpd cover art')
      mpdArt.enable(false)
    }
  }
}

const startCoverServer = async () => new Promise((resolve, reject) => {
  console.verbose('[art] starting cover server')

  const server = http.createServer(async (req, res) => {
    const { name } = path.parse(req.url)
    const content = await readFile(CACHED[name])
    if (content === null) {
      console.error('[art] cover server')
      res.write(500)
      res.end()
      return
    }
    res.writeHead(200, {
      'Content-Type': 'image/png'
      // 'Content-Disposition': 'inline; filename="art.png"'
    })
    res.end(content)
  })

  server.listen(undefined, SERVER_IP, err => {
    if (err) {
      return reject(err)
    }
    const address = server.address()
    SERVER_PORT = address.port
    console.verbose('[art] server started at %O', address)
    return resolve()
  })
})

const artStream = (musicDir, song$, client) => song$
  .pipe(
    map(song => song
      ? { uri: path.join(musicDir, song.file), id: song.id }
      : null
    ),
    distinctUntilChanged(
      (a, b) => JSON.stringify(a) === JSON.stringify(b)
    ),
    switchMap(songInfo => getSongArt(songInfo, client)),
    share()
  )

const getSongArt = (songInfo, client) => {
  if (songInfo === null) {
    return of(null)
  }

  const { uri, id } = songInfo

  let tapper = key => console.verbose.bind(console, `[art ${key}] > `)

  return from(getCachedArt(id))
    .pipe(
    // tap(tapper('cached')),
      mergeMap(art => art
        ? of(art)
        : from(getEmbeddedArt(uri))
      ),
      // tap(tapper('embedded')),
      mergeMap(art => art
        ? of(art)
        : from(getArtFromBaseFolder(uri))
      ),
      // tap(tapper('folder scan')),
      mergeMap(art => art
        ? of(art)
        : from(getArtFromMPD(client, uri))
      ),
      // tap(tapper('mpd returned')),
      mergeMap(art => art
        ? of(art)
        : of(DEFAULT_ART)
      ),
      // tap(tapper('fallback art')),
      tap(art => cacheArtFor(id, art)),
      map(art => getArtURL(songInfo, art)),
      tap(tapper('art uri'))
    )
}

const cacheArtFor = (id, art) => {
  if (CACHED[id]) {
    return
  }
  console.verbose('[art] caching art for %s (%s)', id, art)
  CACHED[id] = art
}

const getCachedArt = async (id) => {
  if (CACHED[id]) {
    console.verbose('[art] cache hit for %s', id)
    return CACHED[id]
  }
}

const getEmbeddedArt = uri => extract.extractArtToTmpFile(uri)
const getArtFromBaseFolder = uri => scanfolder.findCoverInFolder(uri)
const getArtFromMPD = (client, uri) => mpdArt.getArtFromMPD(client, uri)

const getArtURL = (songInfo, artPath) => {
  // if null comes into here because fallback is disabled
  // or whatever
  if (artPath === null) {
    return null
  }

  const { ext } = path.parse(artPath)
  const imgname = `${songInfo.id}${ext}`
  return getCoverLink(imgname)
}

const getCoverLink = img => `http://${SERVER_IP}:${SERVER_PORT}/${img}`
