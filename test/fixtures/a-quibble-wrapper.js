_ = require('lodash')
quibble = require('../../lib/quibble')

quibble.ignoreCallsFromThisFile()

module.exports = function() {
  return quibble.apply(this, _.toArray(arguments))
}
