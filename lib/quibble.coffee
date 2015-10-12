_ = require('lodash')

originalRequire = global.require
quibbles = {}
NO_ARG_TOKEN = {}

module.exports = quibble = (path, fake) ->
  global.require = fakeRequire
  quibbles[path] = if arguments.length < 2 then NO_ARG_TOKEN else fake

module.exports.configure = (userConfig) ->
  config = _.extend {},
    defaultFakeCreator: (path) -> {}
  , userConfig
config = quibble.configure()

module.exports.reset = ->
  global.require = originalRequire
  quibbles = {}
  config = quibble.configure()

fakeRequire = (path) ->
  if quibbles.hasOwnProperty(path)
    if quibbles[path] == NO_ARG_TOKEN
      config.defaultFakeCreator(path)
    else
      quibbles[path]
  else
    originalRequire(arguments...)

