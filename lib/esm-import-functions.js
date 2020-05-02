// These functions are in a separate file due to the fact that we need to support Node.js v8, which
// cannot parse the `import` syntax.
// The way it is dealt with is that we require this module only in code paths in `quibble.js`
// that are ESM related.

exports.dummyImportModuleToGetAtPath = async function dummyImportModuleToGetAtPath (modulePath) {
  try {
    await import(modulePath + (modulePath.includes('?') ? '&' : '?') + '__quibbleresolvepath')
  } catch (error) {
    if (error.code === 'QUIBBLE_RESOLVED_PATH') {
      return error.resolvedPath
    } else {
      throw error
    }
  }

  throw new Error(
    'Node.js is not running with the Quibble loader. Run node with "--loader=quibble"'
  )
}

exports.importOriginalModule = (fullImportPath) => import(fullImportPath + '?__quibbleoriginal')
