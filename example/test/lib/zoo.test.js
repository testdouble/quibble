const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const { quibble, setup, teardown } = require('../helper')

require('../../lib/zoo') // drop the zoo in the cache

describe('zoo', function () {
  var subject

  beforeEach(function () {
    setup()

    quibble('../../lib/animals/bear') // return ->'a fake animal'; see helper.js
    quibble('../../lib/animals/lion', function () { return 'a fake lion' })

    subject = require('../../lib/zoo')
  })

  afterEach(function () {
    teardown()
  })

  it('contains a fake animal', function () {
    assert.ok(subject().animals.includes('a fake animal'))
  })

  it('contains a fake lion', function () {
    assert.ok(subject().animals.includes('a fake lion'))
  })
})
