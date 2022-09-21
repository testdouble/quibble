import quibble from './quibble.js'

export default quibble
export const reset = quibble.reset
export const ignoreCallsFromThisFile = quibble.ignoreCallsFromThisFile
export const config = quibble.config
export const isLoaderLoaded = quibble.isLoaderLoaded

let __quibble

export async function resolve (specifier, context, nextResolve) {
  const resolve = () => nextResolve(
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

  if (!__quibble.quibbledModules) {
    return resolve()
  }

  if (specifier === 'quibble') {
    return resolve()
  }

  const stubModuleGeneration = __quibble.stubModuleGeneration

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
  if (!__quibble.quibbledModules) return undefined
  if (!moduleUrl.searchParams.get('__quibble')) return undefined

  const moduleFilepath = moduleUrl.pathname

  const stub = __quibble.quibbledModules.get(moduleFilepath)
  return stub ? [moduleFilepath, stub] : undefined
}

function transformModuleSource ([moduleKey, stubs]) {
  return `
${(stubs.namedExportNames || [])
  .map(
    (name) =>
      `export let ${name} = globalThis[Symbol.for('__quibbleEsmUser')].quibbledModules.get(${JSON.stringify(
        moduleKey
      )}).namedExportStubs["${name}"]`
  )
  .join(';\n')};
${
  stubs.hasDefaultExport
    ? `export default globalThis[Symbol.for('__quibbleEsmUser')].quibbledModules.get(${JSON.stringify(
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
 * @param {Function} nextLoad
 * @returns {Promise<{ source: !(string | SharedArrayBuffer | Uint8Array), format: string}>}
 */
export async function load (url, context, nextLoad) {
  const stubsInfo = getStubsInfo(new URL(url))

  return stubsInfo
    ? { source: transformModuleSource(stubsInfo), format: 'module', shortCircuit: true }
    : nextLoad(url, context)
}

export const globalPreload = ({ port }) => {
  __quibble = globalThis[Symbol.for('__quibbleEsmLoader')] = { stubModuleGeneration: 1, quibbledModules: new Map() }

  port.addEventListener('message', ({ data }) => {
    if (data.type === 'reset') {
      __quibble.quibbledModules = new Map()
      __quibble.stubModuleGeneration++
      hasResetHappened[0] = 0
    } else if (data.type === 'addMockedModule') {
      __quibble.quibbledModules.set(data.fullModulePath, {
        namedExportNames: data.namedExportNames,
        hasDefaultExport: data.hasDefaultExport
      })
      ++__quibble.stubModuleGeneration
      port.postMessage({ type: data.returnMessage })
    }
  })
  const sharedArrayBuffer = new SharedArrayBuffer(4)
  const hasResetHappened = new Int32Array(sharedArrayBuffer)
  port.postMessage({ type: 'ready', hasResetHappened })
  port.unref()

  return `(${thisWillRunInUserThread})(globalThis, port)`
}

export const getGlobalPreloadCode = globalPreload

async function thisWillRunInUserThread (globalThis, port) {
  const events = getBuiltin('events') // eslint-disable-line

  globalThis[Symbol.for('__quibbleEsmUser')] = {
    ...globalThis[Symbol.for('__quibbleEsmUser')],
    reset () {
      if (!loaderAndUserRunInSameThread(globalThis)) {
        port.postMessage({ type: 'reset' })
        hasResetHappened[0] = 1
        Atomics.wait(hasResetHappened, 0, 1)
        hasResetHappened[0] = 0
      } else {
        const __quibble = globalThis[Symbol.for('__quibbleEsmLoader')]
        __quibble.quibbledModules = new Map()
        __quibble.stubModuleGeneration++
      }
    },
    async addMockedModule (fullModulePath, {
      namedExportNames,
      hasDefaultExport
    }) {
      const returnMessage = `addMockedModuleReturn-${Math.random() * 1000000 | 0}`

      port.postMessage({
        type: 'addMockedModule',
        fullModulePath,
        namedExportNames,
        hasDefaultExport,
        returnMessage
      })

      await new Promise((resolve) => {
        const checkMessage = ({ data }) => {
          if (data.type === returnMessage) {
            port.removeEventListener('message', checkMessage)
            resolve()
          }
        }
        port.addEventListener('message', checkMessage)
      })
    }
  }
  const [{ hasResetHappened }] = await events.once(port, 'message')

  function loaderAndUserRunInSameThread (globalThis) {
    return !!globalThis[Symbol.for('__quibbleEsmLoader')]
  }
}
