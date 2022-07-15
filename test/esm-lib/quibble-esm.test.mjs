// This import is important and part of the test,
// as it checks how quibble interacts with internal modules
import 'fs'
import quibble from 'quibble'

export default {
  afterEach: function () { quibble.reset() },
  'mock a module': async function () {
    await quibble.esm('../esm-fixtures/a-module-with-function.mjs', {
      namedExport: 'replacement',
      life: 41,
      namedFunctionExport: () => 'export replacement'
    }, 'default-export-replacement')

    // This import is important, as it checks how quibble interacts with internal modules
    await import('util')

    const result = await import('../esm-fixtures/a-module-with-function.mjs')
    assert.equal(result.default, 'default-export-replacement')
    assert.equal(result.namedExport, 'replacement')
    assert.equal(result.life, 41)
    assert.equal(result.namedFunctionExport(), 'export replacement')
  },
  'mock a module with no named exports': async function () {
    await quibble.esm('../esm-fixtures/a-module.mjs', undefined, 'default-export-replacement')

    const result = await import('../esm-fixtures/a-module.mjs')
    assert.equal(result.default, 'default-export-replacement')
  },
  'mock a module after it is used unmocked': async function () {
    const result1 = await import('../esm-fixtures/a-module.mjs')
    assert.deepEqual({ ...result1 }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41
    }, 'default-export-replacement')

    const result2 = await import('../esm-fixtures/a-module.mjs')
    assert.deepEqual({ ...result2 }, {
      default: 'default-export-replacement',
      namedExport: 'replacement',
      life: 41
    })
  },
  reset: async function () {
    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41
    }, 'default-export-replacement')
    await import('../esm-fixtures/a-module.mjs')

    quibble.reset()

    const result = await import('../esm-fixtures/a-module.mjs')
    assert.deepEqual({ ...result }, {
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })
  },
  'remock a module after reset': async function () {
    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41,
      namedFunctionExport: () => 'export replacement'
    }, 'default-export-replacement')

    await import('../esm-fixtures/a-module.mjs')
    quibble.reset()

    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement 2',
      life: 40
    }, 'default-export-replacement 2')
    const result = await import('../esm-fixtures/a-module.mjs')

    assert.deepEqual({ ...result }, {
      default: 'default-export-replacement 2',
      namedExport: 'replacement 2',
      life: 40
    })
  },
  'mock two modules': async function () {
    await quibble.esm('../esm-fixtures/a-module.mjs', { a: 4 }, 'a-mock')

    await import('../esm-fixtures/b-module.mjs')

    await quibble.esm('../esm-fixtures/b-module.mjs', { a: 4 }, 'b-mock')

    assert.deepEqual((await import('../esm-fixtures/a-module.mjs')).default, 'a-mock')
    assert.deepEqual((await import('../esm-fixtures/b-module.mjs')).default, 'b-mock')
  },
  'mock a 3rd party lib': async function () {
    await quibble.esm('is-promise', undefined, () => 42)

    const { default: result } = await import('is-promise')
    assert.equal(result(), 42)
  },
  'isLoaderLoader returns true if loader as loaded': async function () {
    assert.equal(quibble.isLoaderLoaded(), true)
  },
  'mock a native module': async function () {
    await quibble.esm('fs', {
      async readFileSync () {
        return 42
      }
    })

    const fs = await import('fs')

    assert.equal(await fs.readFileSync(), 42)
  }
}
