'use strict'
const path = require('path')
const { readDir, isFile } = require('./util')

let ENABLED = true

let FILTERS = [
  /^(cover|album)?(art)?\.(png|jpg|jpeg|bmp)$/i

]

exports.enable = enabled => { ENABLED = !!enabled }
exports.setFilters = filters => { FILTERS = filters }

exports.findCoverInFolder = async uri => {
  if (!ENABLED) { return }
  const dir = path.dirname(uri)
  const list = (await readDir(dir))
    .filter(matchesFilter)
    .map(fileName => path.join(dir, fileName))

  // first match which is file (in case of matched folder names etc..)
  for (let file of list) {
    if (await isFile(file)) {
      return file
    }
  }
  console.verbose('[art.scanfolder] no art for %s', uri)
}

const matchesFilter = fileName => {
  for (let filter of FILTERS) {
    if (filter.test && filter.test(fileName)) {
      return true
    } else if (filter === fileName) {
      return true
    }
  }
}
