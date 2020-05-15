const quibble = require('quibble')

module.exports = {
  afterEach: function () { quibble.reset() },
  'used from cjs': async function () {
    const cjsImporingMjs = require('../esm-fixtures/a-module')
    const result1 = await cjsImporingMjs()
    assert.deepEqual({ ...result1 }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41
    }, 'default-export-replacement')

    const result2 = await cjsImporingMjs()
    assert.deepEqual({ ...result2 }, {
      default: 'default-export-replacement',
      namedExport: 'replacement',
      life: 41
    })

    quibble.reset()
    const result3 = await cjsImporingMjs()
    assert.deepEqual({ ...result3 }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement 2',
      life: 40
    }, 'default-export-replacement 2')
    const result4 = await cjsImporingMjs()

    assert.deepEqual({ ...result4 }, {
      default: 'default-export-replacement 2',
      namedExport: 'replacement 2',
      life: 40
    })
  },
  'works for modules that dont exist': async function () {
    await quibble.esm('../esm-fixtures/this-module-does-not-exist.mjs', { named: 'named!' }, 'def-export')
    const result = await import('../esm-fixtures/this-module-does-not-exist.mjs')

    assert.deepEqual({ ...result }, {
      default: 'def-export',
      named: 'named!'
    })
  },
  'ignoreCallsFromThisFile works with ESM': async function () {
    const cjsImporingMjs = require('../esm-fixtures/a-module-ignored')
    const result1 = await cjsImporingMjs()
    assert.deepEqual({ ...result1 }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41
    }, 'default-export-replacement')

    const result2 = await cjsImporingMjs()
    assert.deepEqual({ ...result2 }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    quibble.reset()
    const result3 = await cjsImporingMjs()
    assert.deepEqual({ ...result3 }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement 2',
      life: 40
    }, 'default-export-replacement 2')
    const result4 = await cjsImporingMjs()
    assert.deepEqual({ ...result4 }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })
  },
  'isLoaderLoader returns true if loader as loaded': async function () {
    assert.equal(quibble.isLoaderLoaded(), true)
  }
}
