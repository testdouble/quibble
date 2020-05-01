import quibble from '../../lib/quibble.mjs'
import mocha from 'mocha'
import chai from 'chai'

const { describe, it, afterEach } = mocha
const { expect } = chai

describe('quibble esm', function () {
  afterEach(() => quibble.reset())

  it('should mock a module', async () => {
    quibble('../esm-fixtures/a-module-with-function.mjs', {
      namedExport: 'replacement',
      life: 41,
      namedFunctionExport: () => 'export replacement'
    }, 'default-export-replacement')

    const result = await import('../esm-fixtures/a-module-with-function.mjs')
    expect(result.default).to.equal('default-export-replacement')
    expect(result.namedExport).to.equal('replacement')
    expect(result.life).to.equal(41)
    expect(result.namedFunctionExport()).to.equal('export replacement')
  })

  it('should mock a module with no named exports', async () => {
    quibble('../esm-fixtures/a-module.mjs', undefined, 'default-export-replacement')

    const result = await import('../esm-fixtures/a-module.mjs')
    expect(result.default).to.equal('default-export-replacement')
  })

  it('should mock a module after it is used unmocked', async () => {
    const result1 = await import('../esm-fixtures/a-module.mjs')
    expect({ ...result1 }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })

    quibble('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41
    }, 'default-export-replacement')

    const result2 = await import('../esm-fixtures/a-module.mjs')
    expect({ ...result2 }).to.eql({
      default: 'default-export-replacement',
      namedExport: 'replacement',
      life: 41
    })
  })

  it('should reset', async () => {
    quibble('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41
    }, 'default-export-replacement')
    await import('../esm-fixtures/a-module.mjs')

    quibble.reset()

    const result = await import('../esm-fixtures/a-module.mjs')
    expect({ ...result }).to.eql({
      default: 'default-export',
      namedExport: 'named-export',
      life: 42
    })
  })

  it('should remock a module after reset', async () => {
    quibble('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement',
      life: 41,
      namedFunctionExport: () => 'export replacement'
    }, 'default-export-replacement')

    await import('../esm-fixtures/a-module.mjs')
    quibble.reset()

    quibble('../esm-fixtures/a-module.mjs', {
      namedExport: 'replacement 2',
      life: 40
    }, 'default-export-replacement 2')
    const result = await import('../esm-fixtures/a-module.mjs')

    expect({ ...result }).to.eql({
      default: 'default-export-replacement 2',
      namedExport: 'replacement 2',
      life: 40
    })
  })
})
