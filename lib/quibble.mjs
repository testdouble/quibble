import quibble from './quibble.js'

export default quibble
export const reset = quibble.reset
export const ignoreCallsFromThisFile = quibble.ignoreCallsFromThisFile
export const config = quibble.config
export const isLoaderLoaded = quibble.isLoaderLoaded

/** @typedef {{hasDefaultExportStub: boolean, namedExports: [string]}} ModuleLoaderMockInfo */
/**
 * @type {{
 *  quibbledModules: Map<string, ModuleLoaderMockInfo>,
 *  stubModuleGeneration: number
 * }}
 *
 */
const quibbleLoaderState = {
  quibbledModules: new Map(),
  stubModuleGeneration: 0
}

export async function resolve (specifier, context, nextResolve) {
  const resolve = () =>
    nextResolve(
      specifier.includes('__quibble')
        ? specifier
          .replace(/[?&]__quibbleresolveurl/, '')
          .replace(/[?&]__quibbleoriginal/, '')
        : specifier,
      context
    )

  if (specifier.includes('__quibbleresolveurl')) {
    const resolvedUrl = (await resolve()).url
    const error = new Error()
    error.code = 'QUIBBLE_RESOLVED_URL'
    error.resolvedUrl = resolvedUrl
    throw error
  }

  if (!quibbleLoaderState.quibbledModules) {
    return resolve()
  }

  if (specifier === 'quibble') {
    return resolve()
  }

  if (specifier.includes('__quibbleoriginal')) {
    return resolve()
  }

  const stubModuleGeneration = quibbleLoaderState.stubModuleGeneration
  const { parentURL } = context

  try {
    const { url } = await resolve()

    const quibbledUrl = addQueryToUrl(url, '__quibble', stubModuleGeneration)

    if (url.startsWith('node:') && !getStubsInfo(quibbledUrl)) {
      return { url }
    }

    return { url: quibbledUrl }
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND') {
      return {
        url: parentURL
          ? addQueryToUrl(
            new URL(specifier, parentURL).href
            , '__quibble', stubModuleGeneration)
          : new URL(specifier).href
      }
    } else {
      throw error
    }
  }
}

/**
 * @param {string} moduleUrl
 *
 * @returns {[string, ModuleLoaderMockInfo] | undefined}
 * */
function getStubsInfo (moduleUrl) {
  if (!quibbleLoaderState.quibbledModules) return undefined
  if (!moduleUrl.includes('__quibble=')) return undefined

  const moduleKey = moduleUrl
    .replace(/\?.*/, '')
    .replace(/#.*/, '')

  const moduleMockingInfo = quibbleLoaderState.quibbledModules.get(moduleKey)

  return moduleMockingInfo ? [moduleKey, moduleMockingInfo] : undefined
}

/**
 *
 * @param {[string, ModuleLoaderMockInfo]} options
 * @returns
 */
function transformModuleSource ([moduleKey, mockingInfo]) {
  return `
${mockingInfo.namedExports
  .map(
    (name) =>
      `export let ${name} = globalThis[Symbol.for('__quibbleUserState')].quibbledModules.get(${JSON.stringify(
        moduleKey
      )}).namedExportStubs["${name}"]`
  )
  .join(';\n')};
${
  mockingInfo.hasDefaultExport
    ? `export default globalThis[Symbol.for('__quibbleUserState')].quibbledModules.get(${JSON.stringify(
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
  const mockingInfo = getStubsInfo(url)

  return mockingInfo
    ? {
        source: transformModuleSource(mockingInfo),
        format: 'module',
        shortCircuit: true
      }
    : await nextLoad(url.replace(/\?.*/, '').replace(/#.*/, ''), context)
}

export const globalPreload = ({ port }) => {
  globalThis[Symbol.for('__quibbleLoaderState')] = quibbleLoaderState

  port.addEventListener('message', ({ data }) => {
    if (data.type === 'reset') {
      quibbleLoaderState.quibbledModules = new Map()
      quibbleLoaderState.stubModuleGeneration++
      Atomics.store(data.hasResetHappened, 0, 1)
      Atomics.notify(data.hasResetHappened, 0)
    } else if (data.type === 'addMockedModule') {
      quibbleLoaderState.quibbledModules.set(data.moduleUrl, {
        namedExports: data.namedExports,
        hasDefaultExport: data.hasDefaultExport
      })
      ++quibbleLoaderState.stubModuleGeneration
      Atomics.store(data.hasAddMockedHappened, 0, 1)
      Atomics.notify(data.hasAddMockedHappened, 0)
    }
  })
  port.unref()

  return `(${thisWillRunInUserThread})(globalThis, port)`
}

async function thisWillRunInUserThread (globalThis, port) {
  globalThis[Symbol.for('__quibbleUserState')] = { quibbledModules: new Map() }

  globalThis[Symbol.for('__quibbleUserToLoaderCommunication')] = {
    reset () {
      globalThis[Symbol.for('__quibbleUserState')].quibbledModules = new Map()

      if (!loaderAndUserRunInSameThread(globalThis)) {
        const hasResetHappened = new Int32Array(new SharedArrayBuffer(4))
        port.postMessage({ type: 'reset', hasResetHappened })
        Atomics.wait(hasResetHappened, 0, 0)
      } else {
        const quibbleLoaderState = globalThis[Symbol.for('__quibbleLoaderState')]

        quibbleLoaderState.quibbledModules = new Map()
        quibbleLoaderState.stubModuleGeneration++
      }
    },
    async addMockedModule (
      moduleUrl,
      { namedExportStubs, defaultExportStub }
    ) {
      globalThis[Symbol.for('__quibbleUserState')].quibbledModules.set(moduleUrl, {
        defaultExportStub,
        namedExportStubs
      })

      if (!loaderAndUserRunInSameThread(globalThis)) {
        const hasAddMockedHappened = new Int32Array(new SharedArrayBuffer(4))

        port.postMessage({
          type: 'addMockedModule',
          moduleUrl,
          namedExports: Object.keys(namedExportStubs || []),
          hasDefaultExport: defaultExportStub != null,
          hasAddMockedHappened
        })
        Atomics.wait(hasAddMockedHappened, 0, 0)
      } else {
        const quibbleLoaderState = globalThis[Symbol.for('__quibbleLoaderState')]

        quibbleLoaderState.quibbledModules.set(moduleUrl, {
          hasDefaultExport: defaultExportStub != null,
          namedExports: Object.keys(namedExportStubs || [])
        })
        ++quibbleLoaderState.stubModuleGeneration
      }
    }
  }

  function loaderAndUserRunInSameThread (globalThis) {
    return !!globalThis[Symbol.for('__quibbleLoaderState')]
  }
}

function addQueryToUrl (url, query, value) {
  const urlObject = new URL(url)
  urlObject.searchParams.set(query, value)
  return urlObject.href
}
