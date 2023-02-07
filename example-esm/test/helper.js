const { beforeEach, afterEach } = require('mocha')
const quibble = require('quibble')

beforeEach(async function () {
  await quibble.esm('../lib/animals/bear.mjs', undefined, function () { return 'a fake bear' })
  await quibble.esm('../lib/animals/lion.mjs', { default: function () { return 'a fake lion' }})
})

afterEach(function () {
  quibble.reset()
})
