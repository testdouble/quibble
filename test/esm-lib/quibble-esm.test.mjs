// This import is important and part of the test,
// as it checks how quibble interacts with internal modules
import 'fs'
import quibble from 'quibble'
import { fileURLToPath, pathToFileURL } from 'url'

const __filename = fileURLToPath(import.meta.url)

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
  },
  'quibble is never mocked': async function () {
    await quibble.esm('fs', {
      async readFileSync () {
        return 42
      }
    })

    await import('quibble')

    const fs = await import('fs')

    assert.equal(await fs.readFileSync(), 42)
  },
  'namedExport will implicitly be converted to the "default" export': async function () {
    await quibble.esm('../esm-fixtures/a-module-with-function.mjs', {
      default: 'default-export-replacement',
      namedExport: 'replacement',
      life: 41,
      namedFunctionExport: () => 'export replacement'
    })

    // This import is important, as it checks how quibble interacts with internal modules
    await import('util')

    const result = await import('../esm-fixtures/a-module-with-function.mjs')
    assert.equal(result.default, 'default-export-replacement')
    assert.equal(result.namedExport, 'replacement')
    assert.equal(result.life, 41)
    assert.equal(result.namedFunctionExport(), 'export replacement')
  },
  'a "default" named export stub along with a "default" export is a conflict and thus an error':
    async function () {
      await assertThrows(() => quibble.esm('../esm-fixtures/a-module-with-function.mjs', {
        default: 'default-export-replacement',
        namedExport: 'replacement',
        life: 41,
        namedFunctionExport: () => 'export replacement'
      }, 'conflict with the above named export')
      , "conflict between a named export with the name 'default'")
    },
  'ensure named exports is an object': async function () {
    await assertThrows(() => quibble.esm('../esm-fixtures/a-module.mjs',
      'this should be an object')
    , 'namedExportsStub argument must be either a plain object')

    await assertThrows(() => quibble.esm('../esm-fixtures/a-module.mjs',
      ['this should be an object'])
    , 'namedExportsStub argument must be either a plain object')

    await assertThrows(() => quibble.esm('../esm-fixtures/a-module.mjs',
      function () { 'this should be an object' })
    , 'namedExportsStub argument must be either a plain object')

    // Should still allow Proxy.
    await quibble.esm('../esm-fixtures/a-module.mjs', new Proxy({}, {}))
  },
  'list mocked modules': async function () {
    await quibble.esm('../esm-fixtures/a-module-with-function.mjs', {
      namedExport: 'replacement',
      life: 41,
      namedFunctionExport: () => 'export replacement'
    }, 'default-export-replacement')

    assert.deepEqual(quibble.listMockedModules(), [
      pathToFileURL(quibble.absolutify('../esm-fixtures/a-module-with-function.mjs', __filename)).href
    ])
    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41,
      namedFunctionExport: () => 'export replacement'
    }, 'default-export-replacement')

    assert.deepEqual(quibble.listMockedModules(), [
      pathToFileURL(quibble.absolutify('../esm-fixtures/a-module-with-function.mjs', __filename)).href,
      pathToFileURL(quibble.absolutify('../esm-fixtures/a-module.mjs', __filename)).href
    ])

    quibble.reset()

    assert.deepEqual(quibble.listMockedModules(), [])
  }
}

async function assertThrows (asyncFunc, messageContained) {
  try {
    await asyncFunc()
    assert.fail(`function did not throw exception with ${messageContained}`)
  } catch (err) {
    assert.equal(err.message.includes(messageContained), true)
  }
}
