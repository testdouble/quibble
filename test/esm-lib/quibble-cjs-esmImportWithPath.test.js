const path = require('path')
const quibble = require('quibble')

module.exports = {
  afterEach: function () { quibble.reset() },
  'support importing esm and returning the path for a relative url': async function () {
    const { modulePath, module } = await quibble.esmImportWithPath('../esm-fixtures/a-module.mjs')

    assert.deepEqual(modulePath, path.resolve(__dirname, '../esm-fixtures/a-module.mjs'))
    assert.deepEqual({ ...module }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })
  },
  'support importing esm and returning the path for a bare specifier': async function () {
    // This test that `is-promise` is a dual-mode module where
    // the entry points are index.js and index.mjs. If thie changes in the future, you
    // can always create a module of your own and put it in node_modules.
    const { modulePath, module } = await quibble.esmImportWithPath('is-promise')

    assert.deepEqual(modulePath, require.resolve('is-promise').replace('.js', '.mjs'))
    const { default: isPromise, ...rest } = module
    assert.deepEqual(rest, {})
    assert.deepEqual(isPromise(Promise.resolve()), true)
    assert.deepEqual(isPromise(42), false)
  },
  'support importing esm and returning the path even when relative path quibbled': async function () {
    await quibble.esm('./a-module.mjs', {
      namedExport: 'replacement',
      life: 41,
      namedFunctionExport: () => 'export replacement'
    }, 'default-export-replacement')
    const { modulePath, module } = await quibble.esmImportWithPath('../esm-fixtures/a-module.mjs')

    assert.deepEqual(modulePath, path.resolve(__dirname, '../esm-fixtures/a-module.mjs'))
    assert.deepEqual({ ...module }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })
  },
  'support importing esm and returning the path even when bare-specifier quibbled': async function () {
    // This test that `is-promise` is a dual-mode module where
    // the entry points are index.js and index.mjs. If thie changes in the future, you
    // can always create a module of your own and put it in node_modules.
    await quibble.esm('is-promise', undefined, 42)
    const { modulePath, module } = await quibble.esmImportWithPath('is-promise')

    assert.deepEqual(modulePath, require.resolve('is-promise').replace('.js', '.mjs'))
    const { default: isPromise, ...rest } = module
    assert.deepEqual(rest, {})
    assert.deepEqual(isPromise(Promise.resolve()), true)
    assert.deepEqual(isPromise(42), false)
  }
}
