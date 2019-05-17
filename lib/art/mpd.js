'use strict'
const path = require('path')
const { saveFile, getTmpFile } = require('./util')

let ENABLED = true

exports.enable = enabled => { ENABLED = !!enabled }

exports.getArtFromMPD = async (client, uri) => {
  if (!ENABLED) { return }

  let art
  try {
    art = await client.api.db.albumartWhole(uri)
  } catch (e) { }
  if (!art) {
    console.verbose('[art.mpd] no art for %s', uri)
    return
  }
  const parsed = path.parse(uri)
  const { ext, buffer } = art
  const tmpFile = getTmpFile(`${parsed.name}-cover.${ext || 'jpg'}`)
  return saveFile(tmpFile, buffer)
}
