// Shared logic for the resolve/load hooks: the async ones in quibble.mjs
// (--loader / register) and the sync ones in quibble-sync-hooks.js
// (registerHooks). Kept as CJS so both can load it without an extra
// module-format dance.
//
// Only planResolve/finishResolve/recoverResolve/stubbedLoadResult and
// stripQueryAndHash are used outside this file; everything else here is a
// private helper for them.

/**
 * @typedef {{hasDefaultExport: boolean, namedExports: [string]}} ModuleLoaderMockInfo
 * @typedef {{
 *   quibbledModules: Map<string, ModuleLoaderMockInfo>,
 *   stubModuleGeneration: number
 * }} QuibbleLoaderState
 */

/**
 * `state.quibbledModules` is read on every call (never cached by callers):
 * reset() replaces the Map.
 *
 * @param {QuibbleLoaderState} state
 * @param {string} moduleUrl
 * @returns {[string, ModuleLoaderMockInfo] | undefined}
 */
function getStubsInfo (state, moduleUrl) {
  if (!state.quibbledModules) return undefined
  if (!moduleUrl.includes('__quibble=')) return undefined

  const moduleKey = stripQueryAndHash(moduleUrl)
  const moduleMockingInfo = state.quibbledModules.get(moduleKey)

  return moduleMockingInfo ? [moduleKey, moduleMockingInfo] : undefined
}

/**
 * @param {[string, ModuleLoaderMockInfo]} options
 * @returns {string}
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

function stripQueryAndHash (url) {
  return url.replace(/\?.*/, '').replace(/#.*/, '')
}

/** Removes the marker query params the `import()` helpers add to specifiers */
function stripMarkers (specifier) {
  return specifier.includes('__quibble')
    ? specifier
      .replace(/[?&]__quibbleresolveurl/, '')
      .replace(/[?&]__quibbleoriginal/, '')
    : specifier
}

function addQueryToUrl (url, query, value) {
  const urlObject = new URL(url)
  urlObject.searchParams.set(query, value)
  return urlObject.href
}

/** The URL to fall back to when the default resolver can't find `specifier` */
function unresolvedUrl (specifier, parentURL, generation) {
  return parentURL
    ? addQueryToUrl(new URL(specifier, parentURL).href, '__quibble', generation)
    : new URL(specifier).href
}

/**
 * Decides what a `resolve` hook should do with `specifier`, without calling
 * `nextResolve` (that stays in the driver, since only it knows whether to
 * `await` it). Shared by the async hooks (quibble.mjs) and the sync hooks
 * (quibble-sync-hooks.js).
 *
 * @param {QuibbleLoaderState} state
 * @param {string} specifier
 * @param {object} context
 * @returns {
 *   | { kind: 'reentrant' }
 *   | { kind: 'resolveUrl' | 'passthrough', nextSpecifier: string }
 *   | { kind: 'quibble', nextSpecifier: string, specifier: string, parentURL: string, stubModuleGeneration: number }
 * }
 */
function planResolve (state, specifier, context) {
  if (specifier.includes('__quibbleresolveurl')) {
    return { kind: 'resolveUrl', nextSpecifier: stripMarkers(specifier) }
  }

  if (!state.quibbledModules || specifier === 'quibble' || specifier.includes('__quibbleoriginal')) {
    return { kind: 'passthrough', nextSpecifier: stripMarkers(specifier) }
  }

  // Only here - resolving a plain, unmarked specifier - do we need to worry
  // about Node 22+ re-entering this hook recursively while we're in the
  // middle of our own `nextResolve` call below (e.g. while walking
  // conditional/array-form `exports` fallbacks), handing back the same
  // `context` object. Left unhandled, that re-entrant call would look just
  // like a brand new import and get quibble-ified a second time.
  //
  // `context.__quibbleSuppressed` (set/cleared by the driver around
  // `nextResolve`) flags that window. Node can also reuse/pool the same
  // `context` object across *unrelated* resolutions, so this check is
  // deliberately placed after every marker-based branch above: a stale
  // leaked flag can at worst make us skip quibble-ifying one plain import
  // that should have gotten one, never corrupt the stripping of an
  // explicitly marked specifier (which is what caused a prior version of
  // this fix to regress testdouble.js's test suite).
  if (context.__quibbleSuppressed) {
    return { kind: 'reentrant' }
  }

  return {
    kind: 'quibble',
    nextSpecifier: stripMarkers(specifier),
    specifier,
    parentURL: context.parentURL,
    stubModuleGeneration: state.stubModuleGeneration
  }
}

/**
 * Interprets what `nextResolve` returned for a plan from `planResolve`.
 * `normalizeUrl` (only needed by the sync hooks) strips a `__quibble` tag a
 * coexisting off-thread `--loader=quibble` may have already added.
 *
 * @param {QuibbleLoaderState} state
 * @param {ReturnType<typeof planResolve>} plan
 * @param {object} result - whatever `nextResolve` returned
 * @param {(url: string) => string} [normalizeUrl]
 */
function finishResolve (state, plan, result, normalizeUrl = url => url) {
  if (plan.kind === 'resolveUrl') {
    const error = new Error()
    error.code = 'QUIBBLE_RESOLVED_URL'
    error.resolvedUrl = normalizeUrl(result.url)
    throw error
  }

  if (plan.kind === 'passthrough') {
    return result
  }

  const { url: nextUrl, ...ctx } = result
  const url = normalizeUrl(nextUrl)
  const quibbledUrl = addQueryToUrl(url, '__quibble', plan.stubModuleGeneration)

  if (url.startsWith('node:') && !getStubsInfo(state, quibbledUrl)) {
    return { ...ctx, url } // It's allowed to change ctx for a builtin (but unlikely)
  }

  return { ...ctx, url: quibbledUrl }
}

/**
 * Interprets an error `nextResolve` threw for a plan from `planResolve`.
 * Either returns the fallback result for a `'quibble'` plan's
 * `ERR_MODULE_NOT_FOUND`, or rethrows.
 *
 * @param {ReturnType<typeof planResolve>} plan
 * @param {Error} error
 */
function recoverResolve (plan, error) {
  if (plan.kind === 'quibble' && error.code === 'ERR_MODULE_NOT_FOUND') {
    return {
      url: unresolvedUrl(plan.specifier, plan.parentURL, plan.stubModuleGeneration),
      shortCircuit: true
    }
  }

  throw error
}

/**
 * The `load` hook's stub/passthrough decision. Returns the stub result, or
 * `undefined` when the driver should call `nextLoad` itself (its return
 * needs an `await` in the async hooks and not in the sync ones, so that part
 * stays in each driver).
 *
 * @param {QuibbleLoaderState} state
 * @param {string} url
 */
function stubbedLoadResult (state, url) {
  const mockingInfo = getStubsInfo(state, url)

  return mockingInfo
    ? {
        source: transformModuleSource(mockingInfo),
        format: 'module',
        shortCircuit: true
      }
    : undefined
}

module.exports = {
  planResolve,
  finishResolve,
  recoverResolve,
  stubbedLoadResult,
  stripQueryAndHash
}
