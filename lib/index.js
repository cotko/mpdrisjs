'use strict'
const service = require('./service')
const os = require('os')

const DEFAULT_OPTS = {
  connection: {
    host: 'localhost',
    port: 6600
  },
  music_dir: '~/Music',
  art: true
}

let CONFIG_FILE = '~/.config/mpdrisjs.js'

const help = (exitCode = 0) => {
  console.log(`

  MPRIS service for MPD

  -c [path=%s]         path to config file
  -v | --verbose                          verbose
  -h | --help
  --version                               print version


  `, CONFIG_FILE)
  process.exit(exitCode)
}

const ARGS = process.argv.reduce((memo, arg) => {
  switch (arg) {
    case '--version':
      console.log(require('./package.json').version)
      process.exit(0)
    case '-h':
    case '--help':
      help()
      break
    case '--verbose':
    case '-v':
      memo.verbose = true
      break
    case '-c':
      memo._nextval = 'config'
      break
    default:
      if (memo._nextval) {
        memo[memo._nextval] = arg
      }
      delete memo._nextval
      break
  }

  return memo
}, {})

console.verbose = (...args) => {
  if (!ARGS.verbose) {
    return
  }
  console.log.apply(console, args)
}

const loadConfig = async () => {
  const configFile = (ARGS.config || CONFIG_FILE)
    .replace(/^~/, os.homedir())
  let config = {}
  try {
    console.verbose('loadging config from %s', configFile)
    config = require(configFile)
  } catch (e) {
    switch (e.code) {
      case 'MODULE_NOT_FOUND':
        console.verbose(' > not found')
        break
      default:
        console.verbose(' > ERROR')
        throw e
    }
  }
  const mergedConfig = {
    ...DEFAULT_OPTS,
    ...config
  }
  if (mergedConfig.music_dir) {
    mergedConfig.music_dir = mergedConfig.music_dir.replace(/^~/, os.homedir())
  }
  return mergedConfig
}

const start = async () => {
  const config = await loadConfig()
  return service.start(config)
}

start().catch(e => {
  console.error(e)
  process.exit(1)
})
