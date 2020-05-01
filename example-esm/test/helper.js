const { beforeEach, afterEach } = require('mocha')
const quibble = require('quibble')

beforeEach(function () {
  quibble('../lib/animals/bear.mjs', undefined, function () { return 'a fake bear' })
  quibble('../lib/animals/lion.mjs', undefined, function () { return 'a fake lion' })
})

afterEach(function () {
  quibble.reset()
})
