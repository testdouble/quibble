// Shared logic for the resolve/load hooks: the async ones in quibble.mjs
// (--loader / register) and the sync ones in quibble-sync-hooks.js
// (registerHooks). Kept as CJS so both can load it without an extra
// module-format dance.
//
// Only planResolve/nextResolveContext/finishResolve/recoverResolve/
// forgetUnresolvedError/stubbedLoadResult and stripQueryAndHash are used
// outside this file;
// everything else here is a private helper for them.

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
  const mockingInfoSource = `globalThis[Symbol.for('__quibbleUserState')].quibbledModules.get(${JSON.stringify(
    moduleKey
  )})`

  // Export names don't have to be identifiers (Node 24+ gives CommonJS modules
  // a 'module.exports' one), so bind each stub to a local and export that
  // under its name as a string
  return `
${mockingInfo.namedExports
  .map(
    (name, i) =>
      `let __quibbleExport${i} = ${mockingInfoSource}.namedExportStubs[${JSON.stringify(name)}];
export { __quibbleExport${i} as ${JSON.stringify(name)} };`
  )
  .join('\n')}
${
  mockingInfo.hasDefaultExport
    ? `export default ${mockingInfoSource}.defaultExportStub;`
    : ''
}
`
}

// The `ERR_MODULE_NOT_FOUND` that `nextResolve` threw for each URL that
// recoverResolve() handed back in its place, so that load() can rethrow it
// if nothing ends up mocking that URL. Keyed without the query: on Node 26+,
// `--loader=quibble` runs alongside the registerHooks() hooks, which re-tag
// the URL with their own generation and strip it before calling nextLoad
const unresolvedErrors = new Map()

function stripQueryAndHash (url) {
  return url.replace(/\?.*/, '').replace(/#.*/, '')
}

const RESOLVE_URL_MARKER = /[?&]__quibbleresolveurl(?:=([^&#]*))?/

/** Removes the marker query params the `import()` helpers add to specifiers */
function stripMarkers (specifier) {
  return specifier.includes('__quibble')
    ? specifier
      .replace(RESOLVE_URL_MARKER, '')
      .replace(/[?&]__quibbleoriginal/, '')
    : specifier
}

/**
 * The context to call `nextResolve` with for a plan from `planResolve`: the
 * same one, unless the plan has to be resolved from a different parent.
 * Call it after flagging `context.__quibbleSuppressed`, so the copy is
 * flagged too.
 */
function nextResolveContext (plan, context) {
  return plan.resolveFromURL
    ? { ...context, parentURL: plan.resolveFromURL }
    : context
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
 *   | { kind: 'resolveUrl', nextSpecifier: string, resolveFromURL: string | undefined }
 *   | { kind: 'passthrough', nextSpecifier: string }
 *   | { kind: 'quibble', nextSpecifier: string, specifier: string, parentURL: string, stubModuleGeneration: number }
 * }
 */
function planResolve (state, specifier, context) {
  if (specifier.includes('__quibbleresolveurl')) {
    // The marker's value, if any, is the URL of the file that asked quibble
    // to resolve `specifier`: resolve from there and not from the `import()`
    // in esm-import-functions.js, which can't see that file's dependencies
    // when they're not installed in a flat node_modules (e.g. pnpm).
    const encodedResolveFromURL = specifier.match(RESOLVE_URL_MARKER)[1]
    return {
      kind: 'resolveUrl',
      nextSpecifier: stripMarkers(specifier),
      resolveFromURL: encodedResolveFromURL && decodeURIComponent(encodedResolveFromURL)
    }
  }

  if (specifier === 'quibble' || specifier.includes('__quibbleoriginal')) {
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
    const url = unresolvedUrl(plan.specifier, plan.parentURL, plan.stubModuleGeneration)
    const key = stripQueryAndHash(url)
    // If several files import the same missing module, keep the first one's
    // error, since Node only loads it once
    if (!unresolvedErrors.has(key)) {
      unresolvedErrors.set(key, error)
    }
    return { url, shortCircuit: true }
  }

  throw error
}

/**
 * Called with every URL `nextResolve` resolved: the module exists now, so an
 * earlier failure to find it no longer applies.
 *
 * @param {string} url
 */
function forgetUnresolvedError (url) {
  unresolvedErrors.delete(stripQueryAndHash(url))
}

/**
 * The `load` hook's stub/passthrough decision. Returns the stub result,
 * throws the resolve error for a URL that doesn't exist and isn't mocked, or
 * returns `undefined` when the driver should call `nextLoad` itself (its return
 * needs an `await` in the async hooks and not in the sync ones, so that part
 * stays in each driver).
 *
 * @param {QuibbleLoaderState} state
 * @param {string} url
 */
function stubbedLoadResult (state, url) {
  const mockingInfo = getStubsInfo(state, url)
  const strippedUrl = stripQueryAndHash(url)

  // Loading it would fail with an `ENOENT` instead, see recoverResolve()
  if (!mockingInfo && unresolvedErrors.has(strippedUrl)) {
    throw unresolvedErrors.get(strippedUrl)
  }

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
  nextResolveContext,
  finishResolve,
  recoverResolve,
  forgetUnresolvedError,
  stubbedLoadResult,
  stripQueryAndHash
}
