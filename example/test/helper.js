const quibble = require('quibble')

exports.quibble = quibble

exports.setup = function () {
  // Config a default response for quibbles (usually in a spec helper)
  quibble.config({
    defaultFakeCreator: function (path) {
      return function () { return 'a fake animal' }
    }
  })
}

exports.teardown = function () {
  quibble.reset()
}
