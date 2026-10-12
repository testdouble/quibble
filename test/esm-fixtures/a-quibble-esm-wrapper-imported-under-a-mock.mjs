// Like a-quibble-esm-wrapper.mjs, but only ever imported while a mock
// exists, so quibble's loader gives it a `?__quibble=<generation>` URL
import quibble from '../../lib/quibble.mjs'

quibble.ignoreCallsFromThisFile()

export const url = import.meta.url

export default (specifier, namedExportStubs, defaultExportStub) =>
  quibble.esm(specifier, namedExportStubs, defaultExportStub)
