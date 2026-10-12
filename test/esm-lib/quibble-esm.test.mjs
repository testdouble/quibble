// This import is important and part of the test,
// as it checks how quibble interacts with internal modules
import 'fs'
import quibble from 'quibble'
import { fileURLToPath, pathToFileURL } from 'url'
import { mkdtemp, realpath, rm, writeFile } from 'fs/promises'
import os from 'os'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const nodeMajorVersion = parseInt(process.versions.node, 10)

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
  'mock named exports whose names are not identifiers': async function () {
    await quibble.esm('../esm-fixtures/a-module.mjs', {
      'module.exports': 'module-exports-replacement',
      'kebab-case': 'kebab-case-replacement',
      'has "quotes" and \\backslashes\\': 'quotes-replacement'
    }, 'default-export-replacement')

    const result = await import('../esm-fixtures/a-module.mjs')
    assert.equal(result['module.exports'], 'module-exports-replacement')
    assert.equal(result['kebab-case'], 'kebab-case-replacement')
    assert.equal(result['has "quotes" and \\backslashes\\'], 'quotes-replacement')
    assert.equal(result.default, 'default-export-replacement')
  },
  'mock a CommonJS module with the named exports Node gives it': async function () {
    // Node 24+ gives CommonJS modules a 'module.exports' named export, which
    // testdouble.js's td.replaceEsm() passes along when imitating a module
    const { default: _, ...namedExports } = await import('lodash/isPlainObject.js')
    const namedExportStubs = Object.fromEntries(Object.keys(namedExports).map(name => [name, 'replacement']))
    await quibble.esm('lodash/isPlainObject.js', namedExportStubs, () => 'default-export-replacement')

    const result = await import('lodash/isPlainObject.js')
    assert.equal(result.default(), 'default-export-replacement')
    for (const name of Object.keys(namedExports)) {
      assert.equal(result[name], 'replacement')
    }
  },
  'import() a CommonJS module that requires a quibbled module': async function () {
    // Node's ESM loader caches a not-yet-loaded CommonJS module before
    // requiring it, then reads the exports off that same cache entry
    quibble('../esm-fixtures/a-cjs-dependency.cjs', 'a fake dependency')

    const { default: result } = await import('../esm-fixtures/a-cjs-module-with-a-dependency.cjs')
    assert.equal(result.dependency, 'a fake dependency')
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
  'mock a 3rd party lib that only the caller can resolve': async function () {
    // Lives in test/esm-lib/node_modules, so it can't be resolved from quibble's
    // own lib directory (like a dependency installed by pnpm)
    await quibble.esm('a-dependency-of-the-tests', { namedExport: 'replacement' }, 'default-export-replacement')

    const result = await import('a-dependency-of-the-tests')
    assert.equal(result.default, 'default-export-replacement')
    assert.equal(result.namedExport, 'replacement')
  },
  'mock the caller\'s copy of a 3rd party lib when quibble can resolve a different copy': async function () {
    // test/esm-lib/node_modules/is-number shadows the real one in the root
    // node_modules, which is the one quibble's own lib directory resolves to
    // (like a pnpm monorepo where packages need different versions of it)
    await quibble.esm('is-number', undefined, () => 'replacement')

    const { default: isNumber } = await import('is-number')
    assert.equal(isNumber(), 'replacement')
  },
  'mock a 3rd party lib that only the caller of a wrapper that ignores itself can resolve': async function () {
    // Like testdouble.js's td.replaceEsm(): the wrapper's own directory can't
    // resolve the specifier, so it has to be resolved from this file
    const { default: wrappedQuibbleEsm } = await import('../esm-fixtures/a-quibble-esm-wrapper.mjs')
    await wrappedQuibbleEsm('a-dependency-of-the-tests', { namedExport: 'replacement' }, 'default-export-replacement')

    const result = await import('a-dependency-of-the-tests')
    assert.equal(result.default, 'default-export-replacement')
    assert.equal(result.namedExport, 'replacement')
  },
  'a wrapper that ignores itself is ignored even when its URL has a quibble query': async function () {
    // Importing the wrapper while a mock exists tags its URL with
    // `?__quibble=<generation>`, which has to be ignored too. Without this
    // mock nothing gets tagged, so the test would pass on the bug
    await quibble.esm('../esm-fixtures/a-module.mjs', undefined, 'unrelated')
    const { default: wrappedQuibbleEsm, url } = await import('../esm-fixtures/a-quibble-esm-wrapper-imported-under-a-mock.mjs')
    // Before Node 22, a module's URL (and so its stack frames) never has the
    // query, so there the bug can't happen and only the rest of the test runs
    if (nodeMajorVersion >= 22) {
      assert.match(url, /[?&]__quibble=/)
    }

    // Only resolvable from this file's directory, not the wrapper's
    await wrappedQuibbleEsm('./a-module-next-to-this-test.mjs', { namedExport: 'replacement' }, 'default-export-replacement')
    await wrappedQuibbleEsm('a-dependency-of-the-tests', { namedExport: 'replacement' }, 'default-export-replacement')

    const relative = await import('./a-module-next-to-this-test.mjs')
    assert.equal(relative.default, 'default-export-replacement')
    const bare = await import('a-dependency-of-the-tests')
    assert.equal(bare.default, 'default-export-replacement')
  },
  'a wrapper can ignore itself by passing its import.meta.url': async function () {
    // Without this mock nothing gets tagged, see the test above
    await quibble.esm('../esm-fixtures/a-module.mjs', undefined, 'unrelated')
    const { default: wrappedQuibbleEsm, absolutify, url } = await import('../esm-fixtures/a-quibble-esm-wrapper-ignored-by-url.mjs')
    if (nodeMajorVersion >= 22) {
      assert.match(url, /[?&]__quibble=/)
    }

    assert.equal(absolutify('./a-module-next-to-this-test.mjs'), path.join(path.dirname(__filename), 'a-module-next-to-this-test.mjs'))

    await wrappedQuibbleEsm('./a-module-next-to-this-test.mjs', { namedExport: 'replacement' }, 'default-export-replacement')
    const result = await import('./a-module-next-to-this-test.mjs')
    assert.equal(result.default, 'default-export-replacement')
  },
  'mock a module by a package.json imports specifier (#src/...) only the caller can resolve': async function () {
    const usesImports = await import('../esm-fixtures/package-with-imports/uses-imports.mjs')
    await usesImports.mock({ namedExport: 'replacement' }, 'default-export-replacement')

    const result = await usesImports.importModule()
    assert.equal(result.default, 'default-export-replacement')
    assert.equal(result.namedExport, 'replacement')

    const viaPath = await import('../esm-fixtures/package-with-imports/src/a-module.mjs')
    assert.equal(viaPath.default, 'default-export-replacement')
  },
  'mock a module by a package.json imports specifier through a wrapper that ignores itself': async function () {
    const usesImports = await import('../esm-fixtures/package-with-imports/uses-imports.mjs')
    await usesImports.mockThroughWrapper({ namedExport: 'replacement' }, 'default-export-replacement')

    const result = await usesImports.importModule()
    assert.equal(result.default, 'default-export-replacement')
    assert.equal(result.namedExport, 'replacement')
  },
  'esmImportWithPath resolves a package.json imports specifier from the caller': async function () {
    const usesImports = await import('../esm-fixtures/package-with-imports/uses-imports.mjs')
    const { moduleUrl, module } = await usesImports.importWithPath()

    assert.equal(moduleUrl, new URL('../esm-fixtures/package-with-imports/src/a-module.mjs', import.meta.url).href)
    assert.equal(module.default, 'default-export')
    assert.equal(module.namedExport, 'named-export')
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
  },
  'importing a missing module that is not mocked rejects like Node does': async function () {
    // Under the auto-registered loader, quibble's hooks only see imports
    // once something is mocked
    await quibble.esm('../esm-fixtures/a-module.mjs', undefined, 'unrelated')

    await assert.rejects(import('../esm-fixtures/this-module-does-not-exist-and-is-not-mocked.mjs'), {
      code: 'ERR_MODULE_NOT_FOUND',
      message: /Cannot find module '.*this-module-does-not-exist-and-is-not-mocked\.mjs' imported from .*quibble-esm\.test\.mjs/
    })
    await assert.rejects(import('a-package-that-does-not-exist'), {
      code: 'ERR_MODULE_NOT_FOUND',
      message: /Cannot find package 'a-package-that-does-not-exist'/
    })
    await assert.rejects(import('../esm-fixtures/imports-a-missing-module.mjs'), {
      code: 'ERR_MODULE_NOT_FOUND',
      message: /imported from .*imports-a-missing-module\.mjs/
    })
  },
  'a missing module that is created later can be imported': async function () {
    await quibble.esm('../esm-fixtures/a-module.mjs', undefined, 'unrelated')
    // The real path, since Node resolves symlinks (macOS's tmpdir is one)
    const dir = await realpath(await mkdtemp(path.join(os.tmpdir(), 'quibble-')))
    const file = path.join(dir, 'created-later.mjs')

    try {
      await assert.rejects(import(pathToFileURL(file).href), { code: 'ERR_MODULE_NOT_FOUND' })
      await writeFile(file, "export default 'created later'")
      // A new mock gives it a new URL, so Node doesn't hand back the failed import
      await quibble.esm('../esm-fixtures/a-module.mjs', undefined, 'unrelated again')

      const { default: result } = await import(pathToFileURL(file).href)
      assert.equal(result, 'created later')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
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
