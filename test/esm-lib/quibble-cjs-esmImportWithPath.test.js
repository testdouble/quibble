'use strict'
const path = require('path')
const { describe, it, afterEach } = require('mocha')
const { expect } = require('chai')
const quibble = require('../../lib/quibble.js')

describe('quibble cjs esmImportWithPath (unit)', function () {
  afterEach(() => quibble.reset())

  it('should support importing esm and returning the path for a relative url', async () => {
    const { modulePath, module } = await quibble.esmImportWithPath('../esm-fixtures/a-module.mjs')

    expect(modulePath).to.equal(path.resolve(__dirname, '../esm-fixtures/a-module.mjs'))
    expect({ ...module }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })
  })

  it('should support importing esm and returning the path for a bare specifier', async () => {
    // This test that `is-promise` is a dual-mode module where
    // the entry points are index.js and index.mjs. If thie changes in the future, you
    // can always create a module of your own and put it in node_modules.
    const { modulePath, module } = await quibble.esmImportWithPath('is-promise')

    expect(modulePath).to.equal(require.resolve('is-promise').replace('.js', '.mjs'))
    const { default: isPromise, ...rest } = module
    expect(rest).to.eql({})
    expect(isPromise(Promise.resolve())).to.equal(true)
    expect(isPromise(42)).to.equal(false)
  })

  it('should support importing esm and returning the path even when relative path quibbled', async () => {
    await quibble.esm('./a-module.mjs', {
      namedExport: 'replacement',
      life: 41,
      namedFunctionExport: () => 'export replacement'
    }, 'default-export-replacement')
    const { modulePath, module } = await quibble.esmImportWithPath('../esm-fixtures/a-module.mjs')

    expect(modulePath).to.equal(path.resolve(__dirname, '../esm-fixtures/a-module.mjs'))
    expect({ ...module }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })
  })

  it('should support importing esm and returning the path even when bare-specifier quibbled', async () => {
    // This test that `is-promise` is a dual-mode module where
    // the entry points are index.js and index.mjs. If thie changes in the future, you
    // can always create a module of your own and put it in node_modules.
    await quibble.esm('is-promise', undefined, 42)
    const { modulePath, module } = await quibble.esmImportWithPath('is-promise')

    expect(modulePath).to.equal(require.resolve('is-promise').replace('.js', '.mjs'))
    const { default: isPromise, ...rest } = module
    expect(rest).to.eql({})
    expect(isPromise(Promise.resolve())).to.equal(true)
    expect(isPromise(42)).to.equal(false)
  })
})
