import quibble from './quibble.js'
import { thisWillRunInUserThread } from './thisWillRunInUserThread.js'
import helpers from './loader-helpers.js'

const {
  planResolve,
  finishResolve,
  recoverResolve,
  stubbedLoadResult,
  stripQueryAndHash
} = helpers

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

// The decision logic - what to do with a given specifier/URL - lives in
// planResolve()/finishResolve()/recoverResolve() (loader-helpers.js), shared
// with the sync hooks in quibble-sync-hooks.js. This is just the async
// driver for it: decide the plan, call nextResolve (awaited, suppressed
// unless the plan says not to), and let finishResolve/recoverResolve
// interpret the outcome.
export async function resolve (specifier, context, nextResolve) {
  const plan = planResolve(quibbleLoaderState, specifier, context)

  if (plan.kind === 'reentrant') {
    return nextResolve(specifier, context)
  }

  context.__quibbleSuppressed = true
  try {
    const result = await nextResolve(plan.nextSpecifier, context)
    return finishResolve(quibbleLoaderState, plan, result)
  } catch (error) {
    return recoverResolve(plan, error)
  } finally {
    context.__quibbleSuppressed = false
  }
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
  return stubbedLoadResult(quibbleLoaderState, url) ??
    await nextLoad(stripQueryAndHash(url), context)
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
    } else if (data.type === 'listMockedModules') {
      const mockedModules = Array.from(quibbleLoaderState.quibbledModules.keys())
      const serializedMockedModules = mockedModules.join(' ')
      const encodedMockedModules = new TextEncoder().encode(serializedMockedModules)

      data.mockedModulesListLength[0] = encodedMockedModules.length
      if (encodedMockedModules.length <= data.mockedModulesList.length) {
        for (let i = 0; i < encodedMockedModules.length; ++i) {
          data.mockedModulesList[i] = encodedMockedModules[i]
        }
      }
      Atomics.store(data.hasListMockedModulesHappened, 0, 1)
      Atomics.notify(data.hasListMockedModulesHappened, 0)
    }
  })
  port.unref()

  return `(${thisWillRunInUserThread})(globalThis, port)`
}
