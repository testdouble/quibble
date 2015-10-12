_ = require('lodash')
lolModule = require('module')
originalRequire = lolModule.prototype.require
config = null

quibbles = {}
NO_ARG_TOKEN = {}

module.exports = quibble = (path, fake) ->
  lolModule.prototype.require = fakeRequire
  quibbles[path] = if arguments.length < 2 then NO_ARG_TOKEN else fake

quibble.config = (userConfig) ->
  config = _.extend {},
    defaultFakeCreator: (path) -> {}
  , userConfig
config = quibble.config()

module.exports.reset = ->
  lolModule.prototype.require = originalRequire
  quibbles = {}
  config = quibble.config()

fakeRequire = (path) ->
  if quibbles.hasOwnProperty(path)
    if quibbles[path] == NO_ARG_TOKEN
      config.defaultFakeCreator(path)
    else
      quibbles[path]
  else
    originalRequire(arguments...)

