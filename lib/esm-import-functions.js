const path = require('path')
const { pathToFileURL } = require('url')

exports.dummyImportModuleToGetAtPath = async function dummyImportModuleToGetAtPath (modulePath) {
  try {
    const moduleUrl = path.isAbsolute(modulePath) ? pathToFileURL(modulePath) : modulePath

    await import(addQueryToUrl(moduleUrl, '__quibbleresolveurl'))
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

function addQueryToUrl (url, query) {
  try {
    const urlObject = new URL(url)
    urlObject.searchParams.set(query, '')
    return urlObject.href.replace(`${query}=`, query)
  } catch {
    return url + '?' + query
  }
}
