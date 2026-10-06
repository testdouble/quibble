const path = require('path')
const { pathToFileURL } = require('url')

// `parentUrl` is the file the specifier should be resolved from. Without it,
// the specifier is resolved from this file, which can't see the caller's
// dependencies when they're not installed in a flat node_modules (e.g. pnpm).
exports.dummyImportModuleToGetAtPath = async function dummyImportModuleToGetAtPath (modulePath, parentUrl) {
  try {
    const moduleUrl = path.isAbsolute(modulePath) ? pathToFileURL(modulePath) : modulePath

    await import(addQueryToUrl(moduleUrl, '__quibbleresolveurl', parentUrl))
  } catch (error) {
    if (error.code === 'QUIBBLE_RESOLVED_URL') {
      return error.resolvedUrl
    } else {
      throw error
    }
  }

  throw new Error(
    'Node.js is not running with the Quibble loader. Run node with "--loader=quibble"'
  )
}

exports.importOriginalModule = async (fullImportPath) => {
  return import(addQueryToUrl(fullImportPath, '__quibbleoriginal'))
}

function addQueryToUrl (url, query, value) {
  const queryWithValue = value ? `${query}=${encodeURIComponent(value)}` : query
  try {
    const urlObject = new URL(url)
    urlObject.searchParams.set(query, '')
    return urlObject.href.replace(`${query}=`, queryWithValue)
  } catch {
    return url + '?' + queryWithValue
  }
}
