const quibble = require('../../lib/quibble')

module.exports = {
  'basic behavior': function () {
    const stubbing = quibble('./../fixtures/a-function', function () { return 'kek' })

    assert.equal(stubbing(), 'kek')
    assert.equal(require('./../fixtures/a-function')(), 'kek')
    assert.equal(require('../fixtures/a-function')(), 'kek')
    assert.equal(require('../../test/fixtures/a-function')(), 'kek')
    assert.equal(require('./../fixtures/b-function')(), 'b function')
  },
  'mismatch extensions that resolve to the same thing': function () {
    const stubbing = quibble('./../fixtures/a-function.js', function () { return 'woo' })

    const result = require('../fixtures/a-function')()

    assert.equal(result, 'woo')
  },
  'mismatch extensions where the more specific require wins': function () {
    const stubbing = quibble('./../fixtures/a-function', function () { return 'nope' })
    const stubbing = quibble('./../fixtures/a-function.js', function () { return 'yup' })

    assert.equal(require('../fixtures/a-function')(), 'nope')
    assert.equal(require('../fixtures/a-function.js')(), 'yup')
  },
  '.config': {
    'defaultFakeCreator': function () {
      quibble.config({defaultFakeCreator: function () { return 'lol' }})

      const stubbing = quibble('./lol')

      assert.equal(stubbing, 'lol')
      assert.equal(require('./lol'), 'lol')
    }
  },
  '.reset': {
    'ensure it clears its internal data structure of quibbles': function () {
      quibble('../fixtures/a-function', function () { return 'ha' })
      assert.equal(require('../fixtures/requires-a-function')(), 'loaded ha')

      quibble.reset()

      assert.equal(require('../fixtures/a-function')(), 'the real function')
      assert.equal(require('../fixtures/requires-a-function')(), 'loaded the real function')
    },
    'can quibble again after reset': function () {
      quibble('../fixtures/a-function', function () { return 'ha' })
      assert.equal(require('../fixtures/a-function')(), 'ha')
      assert.equal(require('../fixtures/requires-a-function')(), 'loaded ha')

      quibble.reset()

      quibble('./some-other-thing')
      assert.equal(require('../fixtures/a-function')(), 'the real function')
      quibble('../fixtures/a-function', function () { return 'ha2' })
      assert.equal(require('../fixtures/requires-a-function')(), 'loaded ha2')
    },
    'without a reset': function () {
      quibble('./../fixtures/a-function', function () { return 'ha' })
      quibble('./some-other-thing')

      assert.equal(require('../fixtures/a-function')(), 'ha')
    }
  },
  'blowing the require cache': {
    'requiring-an-already-cached-thing and then quibbling it': function () {
      require('../fixtures/requires-a-function')
      quibble('./../fixtures/a-function', function () { return 'a fake function' })
      const quibbledRequiresAFunction = require('../fixtures/requires-a-function')

      const result = quibbledRequiresAFunction()

      assert.equal(result, 'loaded a fake function')
    }
  },
  afterEach: function () {
    quibble.reset()
  },
  afterAll: function () {
    // Ensure we didn't just screw up the module._load function somehow
    assert.equal(require('module')._load, global.ORIGINAL_MODULE_LOAD)
  }
}
