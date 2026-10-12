// Ignores itself by URL, like a wrapper passing import.meta.url would. Only
// ever imported while a mock exists, so that URL has a `?__quibble=` query
import quibble from '../../lib/quibble.mjs'

quibble.ignoreCallsFromThisFile(import.meta.url)

export const url = import.meta.url

export const absolutify = (relativePath) => quibble.absolutify(relativePath)

export default (specifier, namedExportStubs, defaultExportStub) =>
  quibble.esm(specifier, namedExportStubs, defaultExportStub)
