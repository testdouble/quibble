import quibble from 'quibble'

export default {
  'isLoaderLoader returns false if no loader': async function () {
    assert.equal(quibble.isLoaderLoaded(), false)
  }
}
