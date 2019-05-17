'use strict'
const os = require('os')
const path = require('path')
const fs = require('fs')

exports.getTmpFile = name => path.join(os.tmpdir(), name)
exports.saveFile = (dest, buffer) => new Promise((resolve, reject) => {
  fs.writeFile(dest, buffer, err => {
    if (err) {
      console.verbose('[art:util] error writing file %s', dest)
      return resolve(undefined)
    }
    resolve(dest)
  })
})

exports.isFile = uri => new Promise(resolve => {
  if (typeof uri === 'string' && uri.startsWith('~')) {
    uri = uri.replace(/~/, os.homedir())
  }
  fs.stat(uri, (err, stat) => {
    if (err) {
      console.verbose('[art:util] invalid file uri %s', uri)
      return resolve(false)
    }
    resolve(stat.isFile() ? uri : false)
  })
})

exports.readFile = async uri => new Promise(resolve => {
  fs.readFile(uri, (err, content) => {
    if (err) {
      console.error('[art:util] readFile error %s', uri)
      return resolve(null)
    }
    resolve(content)
  })
})

exports.readDir = async uri => new Promise(resolve => {
  fs.readdir(uri, (err, list) => {
    if (err) {
      console.error('[art:util] readDir error %s', uri)
      return resolve([])
    }
    resolve(list)
  })
})
