const { beforeEach, afterEach } = require('mocha')
const quibble = require('quibble')

beforeEach(function () {
  quibble.esm('../lib/animals/bear.mjs', undefined, function () { return 'a fake bear' })
  quibble.esm('../lib/animals/lion.mjs', undefined, function () { return 'a fake lion' })
  quibble.esm('../lib/foo.json', undefined, { 'hello': 'quibble' })
})

afterEach(function () {
  quibble.reset()
})
