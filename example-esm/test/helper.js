const { beforeEach, afterEach } = require('mocha')
const quibble = require('quibble')

beforeEach(function () {
  quibble.esm('../lib/animals/bear.mjs', undefined, function () { return 'a fake bear' })
  quibble.esm('../lib/animals/lion.mjs', undefined, function () { return 'a fake lion' })
})

afterEach(function () {
  quibble.reset()
})
