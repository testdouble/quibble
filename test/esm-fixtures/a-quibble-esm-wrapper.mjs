// Calls quibble.esm() on behalf of whoever calls it, like testdouble.js's td.replaceEsm()
import quibble from '../../lib/quibble.mjs'

quibble.ignoreCallsFromThisFile()

export default (specifier, namedExportStubs, defaultExportStub) =>
  quibble.esm(specifier, namedExportStubs, defaultExportStub)
