'use strict'

// use ffmpeg to extract the cover art from song files
//

const path = require('path')
const { exec } = require('child_process')
const which = require('which')
const { getTmpFile } = require('./util')
let FFMPEG
let ENABLED = true

exports.enable = enabled => { ENABLED = !!enabled }

exports.available = () => new Promise(resolve => {
  if (FFMPEG) {
    return true
  }

  which('ffmpeg', (err, cmdPath) => {
    if (err || !cmdPath) {
      return resolve(false)
    }
    FFMPEG = cmdPath
    resolve(true)
  })
})

// run now to cache the command if available
exports.available().then(ok => {
  if (!ok) {
    console.verbose('[art.extract] ffmpeg not available, extracting cover art unavailable')
  }
})

exports.extractArtToTmpFile = async file => {
  if (!ENABLED) { return }

  // recheck if command was installed after service was run
  if (!FFMPEG && !(await exports.available())) {
    return null
  }
  const parsed = path.parse(file)
  const tmpFile = getTmpFile(`${parsed.name}-cover.jpg`)

  const cmd = `${FFMPEG} -i "${file}" -y -an -vcodec copy "${tmpFile}"`

  return new Promise(resolve => {
    let EX_CODE
    const proc = exec(cmd, (err, stdout, stderr) => {
      if (err || (stderr && EX_CODE !== 0)) {
        console.verbose('[art.extract] no art for %s', file)
        return resolve(null)
      }
      resolve(tmpFile)
    })
    proc.on('exit', code => { EX_CODE = code })
  })
}
