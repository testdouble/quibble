import chai from 'chai'
import '../../lib/zoo.mjs' // drop the zoo in the cache

const { expect } = chai

describe('zoo', function () {
  var subject

  beforeEach(async function () {
    subject = await import('../../lib/zoo.mjs')
  })

  it('contains a fake bear', function () {
    expect(subject.default().animals).to.contain('a fake bear')
  })

  it('contains a fake lion', function () {
    expect(subject.default().animals).to.contain('a fake lion')
  })
})
