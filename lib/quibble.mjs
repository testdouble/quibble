import quibble from './quibble.js'

export default quibble
export const reset = quibble.reset
export const ignoreCallsFromThisFile = quibble.ignoreCallsFromThisFile
export const config = quibble.config

export async function resolve (specifier, context, defaultResolve) {
  const { parentURL } = context

  if (!global.__quibble || !global.__quibble.quibbledModules) {
    return defaultResolve(specifier, context, defaultResolve)
  }

  const stubModuleGeneration = global.__quibble.stubModuleGeneration

  return {
    url: parentURL
      ? `${new URL(specifier, parentURL).href}?__quibble=${stubModuleGeneration}`
      : new URL(specifier).href
  }
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
${Object.keys(stubs.namedExportReplacements || {})
  .map(
    (name) =>
      `export let ${name} = global.__quibble.quibbledModules.get(${JSON.stringify(
        moduleKey
      )}).namedExportReplacements["${name}"]`
  )
  .join(';\n')};
${
  stubs.defaultExportReplacement
    ? `export default global.__quibble.quibbledModules.get(${JSON.stringify(
        moduleKey
      )}).defaultExportReplacement;`
    : ''
}
`
}
