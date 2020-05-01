const quibble = require('../../lib/quibble.js')
const { describe, it, afterEach } = require('mocha')
const { expect } = require('chai')

describe('quibble cjs ignoreCallsFromThisFile', function () {
  afterEach(() => quibble.reset())

  it('should work even if used from cjs', async () => {
    const cjsImporingMjs = require('../esm-fixtures/a-module-ignored')
    const result1 = await cjsImporingMjs()
    expect({ ...result1 }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    quibble('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41
    }, 'default-export-replacement')

    const result2 = await cjsImporingMjs()
    expect({ ...result2 }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    quibble.reset()
    const result3 = await cjsImporingMjs()
    expect({ ...result3 }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    quibble('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement 2',
      life: 40
    }, 'default-export-replacement 2')
    const result4 = await cjsImporingMjs()
    expect({ ...result4 }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })
  })
})
