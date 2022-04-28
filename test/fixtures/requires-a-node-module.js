// This should import the fake dependency in './node_modules/is-number'
// not the real dependency in '../../node_modules/is-number'
var isNumber = require('is-number')

module.exports = function () {
  return isNumber(1)
}
