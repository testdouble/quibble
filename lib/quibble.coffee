_ = require('lodash')
Module = require('module')
originalLoad = Module._load
config = null

quibbles = {}
NO_ARG_TOKEN = {}

module.exports = quibble = (path, fake) ->
  console.log("HEYYYY #{_getCallerFile()}")
  # resolve absolute path of `path` based on filename of caller
  Module._load = fakeLoad
  quibbles[path] = if arguments.length < 2 then NO_ARG_TOKEN else fake

quibble.config = (userConfig) ->
  config = _.extend {},
    defaultFakeCreator: (path) -> {}
  , userConfig
config = quibble.config()

module.exports.reset = ->
  Module._load = originalLoad
  quibbles = {}
  config = quibble.config()

fakeLoad = (request, parent, isMain) ->
  if quibbles.hasOwnProperty(request)
    if quibbles[request] == NO_ARG_TOKEN
      config.defaultFakeCreator(request)
    else
      quibbles[request]
  else
    filename = Module._resolveFilename(request, parent)
    cachedModule = Module._cache[filename]
    console.log "WAT", cachedModule
    originalLoad(request, parent, isMain)

_getCallerFile = ->
  originalFunc = Error.prepareStackTrace
  Error.prepareStackTrace = (e, stack) -> stack
  e = new Error()
  currentFile = e.stack[0].getFileName()
  callerFile = _.find(e.stack, (line) -> line.getFileName() != currentFile).getFileName()
  Error.prepareStackTrace = originalFunc
  callerFile
