import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { setup, teardown } from '../helper.mjs'

import '../../lib/zoo.mjs' // drop the zoo in the cache

describe('zoo', function () {
  var subject

  beforeEach(async function () {
    await setup()
    subject = await import('../../lib/zoo.mjs')
  })

  afterEach(function () {
    teardown()
  })

  it('contains a fake bear', function () {
    assert.ok(subject.default().animals.includes('a fake bear'))
  })

  it('contains a fake lion', function () {
    assert.ok(subject.default().animals.includes('a fake lion'))
  })
})
