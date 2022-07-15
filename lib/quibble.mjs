import quibble from './quibble.js'

export default quibble
export const reset = quibble.reset
export const ignoreCallsFromThisFile = quibble.ignoreCallsFromThisFile
export const config = quibble.config
export const isLoaderLoaded = quibble.isLoaderLoaded

global.__quibble = { stubModuleGeneration: 1 }

export async function resolve (specifier, context, defaultResolve) {
  const resolve = () => defaultResolve(
    specifier.includes('__quibble')
      ? specifier.replace('?__quibbleresolvepath', '').replace('?__quibbleoriginal', '')
      : specifier,
    context
  )

  if (specifier.includes('__quibbleresolvepath')) {
    const resolvedPath = new URL((await resolve()).url).pathname
    const error = new Error()
    error.code = 'QUIBBLE_RESOLVED_PATH'
    error.resolvedPath = resolvedPath
    throw error
  }

  if (!global.__quibble.quibbledModules) {
    return resolve()
  }

  const stubModuleGeneration = global.__quibble.stubModuleGeneration

  if (specifier.includes('__quibbleoriginal')) {
    return resolve()
  }

  const { parentURL } = context

  try {
    const { url } = await resolve()

    const quibbledUrl = `${url}?__quibble=${stubModuleGeneration}`

    // 'node:' is the prefix for Node >=14.13. 'nodejs:' is for earlier versions
    if (/^node(js){0,1}:/.test(url) && !getStubsInfo(new URL(quibbledUrl))) return { url }

    return { url: quibbledUrl }
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      return {
        url: parentURL
          ? `${new URL(specifier, parentURL).href}?__quibble=${stubModuleGeneration}`
          : new URL(specifier).href
      }
    } else { throw error }
  }
}

export async function getFormat (url, context, defaultGetFormat) {
  if (getStubsInfo(new URL(url))) {
    return {
      format: 'module'
    }
  } else {
    return defaultGetFormat(url, context, defaultGetFormat)
  }
}

export async function getSource (url, context, defaultGetSource) {
  const stubsInfo = getStubsInfo(new URL(url))

  return stubsInfo
    ? { source: transformModuleSource(stubsInfo) }
    : defaultGetSource(url, context, defaultGetSource)
}

/** @param {URL} moduleUrl */
function getStubsInfo (moduleUrl) {
  if (!global.__quibble.quibbledModules) return undefined
  if (!moduleUrl.searchParams.get('__quibble')) return undefined

  const moduleFilepath = moduleUrl.pathname

  return [...global.__quibble.quibbledModules.entries()].find(([m]) => m === moduleFilepath)
}

function transformModuleSource ([moduleKey, stubs]) {
  return `
${Object.keys(stubs.namedExportStubs || {})
  .map(
    (name) =>
      `export let ${name} = global.__quibble.quibbledModules.get(${JSON.stringify(
        moduleKey
      )}).namedExportStubs["${name}"]`
  )
  .join(';\n')};
${
  stubs.defaultExportStub
    ? `export default global.__quibble.quibbledModules.get(${JSON.stringify(
        moduleKey
      )}).defaultExportStub;`
    : ''
}
`
}

/**
 * @param {string} url
 * @param {{
 *   format: string,
 * }} context
 * @param {Function} defaultLoad
 * @returns {Promise<{ source: !(string | SharedArrayBuffer | Uint8Array), format: string}>}
 */
export async function load (url, context, defaultLoad) {
  const stubsInfo = getStubsInfo(new URL(url))

  return stubsInfo
    ? { source: transformModuleSource(stubsInfo), format: 'module' }
    : defaultLoad(url, context, defaultLoad)
}
