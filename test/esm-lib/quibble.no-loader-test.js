const quibble = require('quibble')

module.exports = {
  'throw exception on quibble.esm with no loader': async function () {
    await assertThrows(() => quibble.esm('../esm-fixtures/a-module.mjs'),
      'quibble loader not loaded')
  },
  'throw exception on quibble.esmImportWithPath with no loader': async function () {
    await assertThrows(() => quibble.esmImportWithPath('../esm-fixtures/a-module.mjs'),
      'quibble loader not loaded')
  },
  'isLoaderLoader returns false if no loader': async function () {
    assert.equal(quibble.isLoaderLoaded(), false)
  }
}

async function assertThrows (asyncFunc, messageContained) {
  try {
    asyncFunc()
    assert.fail(`function did not throw exception with ${messageContained}`)
  } catch (err) {
    assert.equal(err.message.includes(messageContained), true)
  }
}
