// Synchronous, same-thread driver for the hooks in `Module.registerHooks()`.
// The decision logic - what to do with a given specifier/URL - lives in
// planResolve()/finishResolve()/recoverResolve() (loader-helpers.js), shared
// with the async hooks in quibble.mjs. This file is only the sync driver for
// it, plus the two things that are genuinely sync-hooks-only (see below).

const {
  planResolve,
  finishResolve,
  recoverResolve,
  stubbedLoadResult,
  stripQueryAndHash
} = require('./loader-helpers')
const { createImportGraph } = require('./import-graph')

/**
 * @param {import('./loader-helpers').QuibbleLoaderState} state
 */
exports.createSyncHooks = function createSyncHooks (state) {
  const importGraph = createImportGraph(state)

  function resolve (specifier, context, nextResolve) {
    // registerHooks() hooks also see CommonJS require() calls, which
    // register()-style hooks never did. Quibble's ESM cache-busting query
    // string would break CJS resolution, so leave those alone. There's no
    // equivalent in the async hooks (Module.register() never sees require()).
    if (isRequire(context)) {
      return nextResolve(specifier, context)
    }

    const plan = planResolve(state, specifier, context)

    if (plan.kind === 'reentrant') {
      return nextResolve(specifier, context)
    }

    context.__quibbleSuppressed = true
    try {
      const result = nextResolve(plan.nextSpecifier, context)
      if (plan.kind === 'quibble') {
        // Same off-thread-loader caveat as below: work with untagged URLs
        const url = removeQuibbleQuery(result.url)
        importGraph.recordImport(context.parentURL && removeQuibbleQuery(context.parentURL), url)
        if (!importGraph.needsQuibbling(url)) {
          return { ...result, url }
        }
      }
      // An explicit `--loader=quibble` can be registered (off-thread)
      // alongside these hooks and will already have tagged the resolved URL;
      // strip it before quibble re-tags it with its own generation number.
      // The async hooks never run alongside another quibble instance.
      return finishResolve(state, plan, result, removeQuibbleQuery)
    } catch (error) {
      const recovered = recoverResolve(plan, error)
      // The import still happened (the module is just mocked without existing),
      // so the importer has to be seen as depending on the mock
      if (plan.kind === 'quibble') {
        importGraph.recordImport(context.parentURL, recovered.url)
      }
      return recovered
    } finally {
      context.__quibbleSuppressed = false
    }
  }

  function load (url, context, nextLoad) {
    const stub = stubbedLoadResult(state, url)
    if (stub) {
      return stub
    }

    // Only real loads count (see the async load hook in quibble.mjs)
    importGraph.recordLoad(url)
    return nextLoad(stripQueryAndHash(url), context)
  }

  return { resolve, load }
}

function isRequire (context) {
  return Array.isArray(context.conditions) && context.conditions.includes('require')
}

function removeQuibbleQuery (url) {
  if (!url.includes('__quibble=')) return url
  const urlObject = new URL(url)
  urlObject.searchParams.delete('__quibble')
  return urlObject.href
}
