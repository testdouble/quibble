import quibble from './quibble.js'

export default quibble
export const reset = quibble.reset
export const ignoreCallsFromThisFile = quibble.ignoreCallsFromThisFile
export const config = quibble.config
export const isLoaderLoaded = quibble.isLoaderLoaded

global.__quibble = { quibbledModules: new Map(), stubModuleGeneration: 1 }

export async function resolve (specifier, context, defaultResolve) {
  const resolve = () => defaultResolve(
    specifier.includes('__quibble')
      ? specifier.replace('?__quibbleresolvepath', '').replace('?__quibbleoriginal', '')
      : specifier,
    context
  )

  if (specifier.includes('__quibbleresolvepath')) {
    const resolvedPath = new URL(resolve().url).pathname
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
    const { url } = resolve()

    return { url: `${url}?__quibble=${stubModuleGeneration}` }
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

export async function getSource (url, context, defaultGetSource) {
  const source = () => defaultGetSource(url, context, defaultGetSource)

  if (!global.__quibble.quibbledModules) {
    return source()
  }
  const urlUrl = new URL(url)
  const shouldBeQuibbled = urlUrl.searchParams.get('__quibble')

  if (!shouldBeQuibbled) {
    return source()
  } else {
    const stubsInfo = getStubsInfo(urlUrl)

    return stubsInfo ? { source: transformModuleSource(stubsInfo) } : source()
  }
}

function getStubsInfo (moduleUrl) {
  if (!global.__quibble.quibbledModules) return undefined

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
