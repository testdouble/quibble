import quibble from './quibble.js'

export default quibble
export const reset = quibble.reset
export const ignoreCallsFromThisFile = quibble.ignoreCallsFromThisFile
export const config = quibble.config

export async function resolve (specifier, context, defaultResolve) {
  const resolveResult = await defaultResolve(
    specifier.includes('__quibble')
      ? specifier.replace('?__quibbleresolvepath', '').replace('?__quibbleoriginal', '')
      : specifier,
    context,
    defaultResolve
  )
  if (specifier.includes('__quibbleresolvepath')) {
    const resolvedPath = new URL(resolveResult.url).pathname
    const error = new Error()
    error.code = 'QUIBBLE_RESOLVED_PATH'
    error.resolvedPath = resolvedPath
    throw error
  }

  if (!global.__quibble || !global.__quibble.quibbledModules) {
    return resolveResult
  }

  const stubModuleGeneration = global.__quibble.stubModuleGeneration

  if (specifier.includes('__quibbleoriginal')) {
    return resolveResult
  }

  return { url: `${resolveResult.url}?__quibble=${stubModuleGeneration}` }
}

export async function transformSource (source, context, defaultTransformSource) {
  const { url } = context
  const urlUrl = new URL(url)
  const shouldBeQuibbled = urlUrl.searchParams.get('__quibble')

  if (!shouldBeQuibbled) {
    return defaultTransformSource(source, context, defaultTransformSource)
  } else {
    const stubsInfo = getStubsInfo(urlUrl)

    if (stubsInfo) {
      return { source: transformModuleSource(stubsInfo) }
    } else {
      return defaultTransformSource(source, context, defaultTransformSource)
    }
  }
}

function getStubsInfo (moduleUrl) {
  if (!global.__quibble || !global.__quibble.quibbledModules) return undefined

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
