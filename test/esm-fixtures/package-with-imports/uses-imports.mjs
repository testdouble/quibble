// Lives in a package whose package.json maps `#src/*`, so `#src/...` specifiers
// only resolve from files in this package, not from the tests or from quibble
import quibble from '../../../lib/quibble.mjs'
import wrappedQuibbleEsm from '../a-quibble-esm-wrapper.mjs'

export const mock = (namedExportStubs, defaultExportStub) =>
  quibble.esm('#src/a-module.mjs', namedExportStubs, defaultExportStub)

export const mockThroughWrapper = (namedExportStubs, defaultExportStub) =>
  wrappedQuibbleEsm('#src/a-module.mjs', namedExportStubs, defaultExportStub)

export const importWithPath = () => quibble.esmImportWithPath('#src/a-module.mjs')

export const importModule = () => import('#src/a-module.mjs')
