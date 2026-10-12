// Statically imports a module that doesn't exist and that no test mocks, to
// check that quibble's loader still fails the import the way Node would
import './this-module-is-imported-but-does-not-exist.mjs'
