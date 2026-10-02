// Keeps `quibble.esm()` from re-evaluating every module on every mock change.
//
// Node can't evict anything from its ESM module cache, so the only way to get
// a fresh instance of a module is to import it under a new URL. Quibble does
// that by tagging URLs with `?__quibble=<generation>`, where the generation
// goes up whenever a mock is added or reset. Tagging *every* module that way
// means each generation re-evaluates, and permanently retains, the whole
// graph of every module imported while any mock exists - including packages
// that have nothing to do with the mock.
//
// Only a module that is mocked, or that can reach a mocked module through its
// imports, needs a fresh URL. This learns those imports from what the
// resolve and load hooks already see (no source parsing, so it behaves the
// same for TypeScript or anything else a loader transforms):
//
//   - recordImport() notes each parent -> child edge the resolve hook sees
//   - recordLoad() notes the generation in which a module was first loaded
//   - needsQuibbling() decides whether a resolved URL should be tagged
//
// Edges are recorded for every import, including ones made while nothing is
// mocked and ones whose target doesn't exist on disk (a module can be mocked
// without existing). Modules loaded earlier count as fully known by the time
// a mock exists, so a missing edge would make a module look like it depends
// on nothing, and it would never see a mock added later. For the same reason,
// loads served as a mock stub are not recorded: a stub has no imports, so
// counting one would make the real module look fully known with no edges.
//
// A module's imports are only fully known once it has finished linking, which
// we take to mean "it was first loaded in an earlier generation". Until then
// it is assumed to be affected and gets tagged, exactly as before. So each
// unaffected module is evaluated about twice (once tagged, once at its plain
// URL) instead of once per generation.
//
// Dynamic `import()` calls need no special handling: they run through the
// resolve hook when they execute, so they see whichever mocks exist then.
// `require()` edges inside CommonJS aren't seen by the async hooks, so a
// CommonJS module is treated as a leaf.
//
// Modules are identified by URL with any query string and hash removed, the
// same way mocks are keyed, so `a.js?v=1` and `a.js?v=2` (separate instances
// in Node) are one node here and get one tagging decision.
//
// One consequence for users: a module that no mock can reach is now a single
// instance for the life of the process, where it used to get a fresh one
// after every mock change. Module-level state in such a module (counters,
// caches, singletons) persists between tests.

const { stripQueryAndHash } = require('./loader-helpers')

/**
 * Relies on every mock change bumping `state.stubModuleGeneration` (the
 * decisions are memoised per generation, and "known" means loaded in an
 * earlier generation), and on reset() replacing `state.quibbledModules`
 * with a new Map. Those updates live in the message handler in quibble.mjs
 * (`globalPreload`), in thisWillRunInUserThread.js (same-thread state), and
 * nowhere else.
 *
 * @param {import('./loader-helpers').QuibbleLoaderState} state - read on every
 *   call, never cached, because reset() replaces `state.quibbledModules`
 */
exports.createImportGraph = function createImportGraph (state) {
  /** @type {Map<string, Set<string>>} plain URL -> plain URLs it imports */
  const imports = new Map()
  /** @type {Map<string, number>} plain URL -> generation of its first load */
  const firstLoadedIn = new Map()
  let decisionsGeneration = -1
  /** @type {Map<string, boolean>} memoised per generation, so one URL never gets two answers */
  let decisions = new Map()

  function recordImport (parentUrl, childUrl) {
    if (!parentUrl) {
      return
    }
    const parent = stripQueryAndHash(parentUrl)
    if (!imports.has(parent)) {
      imports.set(parent, new Set())
    }
    imports.get(parent).add(stripQueryAndHash(childUrl))
  }

  function recordLoad (url) {
    const plainUrl = stripQueryAndHash(url)
    if (!firstLoadedIn.has(plainUrl)) {
      firstLoadedIn.set(plainUrl, state.stubModuleGeneration)
    }
  }

  function needsQuibbling (resolvedUrl) {
    if (!state.quibbledModules.size) {
      return false
    }

    const generation = state.stubModuleGeneration
    if (decisionsGeneration !== generation) {
      decisionsGeneration = generation
      decisions = new Map()
    }

    const url = stripQueryAndHash(resolvedUrl)
    if (!decisions.has(url)) {
      decisions.set(url, mayReachMockedModule(url, generation))
    }
    return decisions.get(url)
  }

  function mayReachMockedModule (startUrl, generation) {
    const seen = new Set([startUrl])
    const queue = [startUrl]
    while (queue.length) {
      const url = queue.shift()
      if (state.quibbledModules.has(url)) {
        return true
      }
      if (url.startsWith('node:')) {
        continue
      }

      const loadedIn = firstLoadedIn.get(url)
      if (loadedIn === undefined || loadedIn >= generation) {
        return true // its imports might not all be known yet
      }
      for (const child of imports.get(url) ?? []) {
        if (!seen.has(child)) {
          seen.add(child)
          queue.push(child)
        }
      }
    }
    return false
  }

  return { recordImport, recordLoad, needsQuibbling }
}
