_ = require('lodash')
Module = require('module')
path = require('path')
originalLoad = Module._load
config = null

quibbles = {}
NO_ARG_TOKEN = {}

module.exports = quibble = (request, fake) ->
  Module._load = fakeLoad
  quibbles[absolutify(request)] = if arguments.length < 2 then NO_ARG_TOKEN else fake

quibble.config = (userConfig) ->
  config = _.extend {},
    defaultFakeCreator: (request) -> {}
  , userConfig
config = quibble.config()

module.exports.reset = ->
  Module._load = originalLoad
  quibbles = {}
  config = quibble.config()

fakeLoad = (request, parent, isMain) ->
  request = absolutify(request)
  if quibbles.hasOwnProperty(request)
    if quibbles[request] == NO_ARG_TOKEN
      config.defaultFakeCreator(request)
    else
      quibbles[request]
  else
    originalLoad(request, parent, isMain)

absolutify = (relativePath) ->
  return relativePath if _.startsWith(relativePath, '/') || /^\w/.test(relativePath)
  path.resolve(path.dirname(_getCallerFile()), relativePath)

_getCallerFile = ->
  originalFunc = Error.prepareStackTrace
  Error.prepareStackTrace = (e, stack) -> stack
  e = new Error()
  currentFile = e.stack[0].getFileName()
  callerFile = _(e.stack).
    select((s) -> _.startsWith(s.getFileName(), '/')).
    find((s) -> s.getFileName() != currentFile).
    getFileName()
  Error.prepareStackTrace = originalFunc
  callerFile
