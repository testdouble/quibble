const { describe, it, afterEach } = require('mocha')
const { expect } = require('chai')
const quibble = require('../../lib/quibble.js')

describe('quibble cjs', function () {
  afterEach(() => quibble.reset())

  it('should work even if used from cjs', async () => {
    const cjsImporingMjs = require('../esm-fixtures/a-module')
    const result1 = await cjsImporingMjs()
    expect({ ...result1 }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41
    }, 'default-export-replacement')

    const result2 = await cjsImporingMjs()
    expect({ ...result2 }).to.eql({
      default: 'default-export-replacement',
      namedExport: 'replacement',
      life: 41
    })

    quibble.reset()
    const result3 = await cjsImporingMjs()
    expect({ ...result3 }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    await quibble.esm('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement 2',
      life: 40
    }, 'default-export-replacement 2')
    const result4 = await cjsImporingMjs()

    expect({ ...result4 }).to.eql({
      default: 'default-export-replacement 2',
      namedExport: 'replacement 2',
      life: 40
    })
  })

  it('should mock bare-specifier modules', async () => {
    await quibble.esm('is-promise', undefined, 42)

    const { default: defaultExport, ...named } = await import('is-promise')

    expect(defaultExport).to.equal(42)
    expect(named).to.eql({})
  })
})
