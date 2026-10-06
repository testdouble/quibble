# 0.12.0

* Fix mocking ES modules by package name (e.g. `quibble.esm('is-number')`)
  under pnpm [#123](https://github.com/testdouble/quibble/pull/123),
  [#84](https://github.com/testdouble/quibble/issues/84)
  * With hoisting off, it failed with `Cannot find package 'x' imported from
    …/quibble/lib/esm-import-functions.js`
  * In a monorepo where packages need different versions of a dependency,
    quibble could silently mock a different copy than the one the test imports
* **Behavior change:** `quibble.esm()` and `quibble.esmImportWithPath()` now
  resolve package names from the calling file (skipping files passed to
  `ignoreCallsFromThisFile()`), as they already did for relative paths;
  they used to resolve package names from quibble's own directory
  * When the calling file and quibble see different copies of a package, the
    calling file's copy is now the one mocked
  * A package only quibble itself depends on can no longer be mocked by name
    unless the calling file can resolve it too

# 0.11.0

* Fix unbounded memory growth when mocking ES modules [#122](https://github.com/testdouble/quibble/pull/122), [#116](https://github.com/testdouble/quibble/issues/116) (see also [testdouble.js#534](https://github.com/testdouble/testdouble.js/issues/534))
* **Behavior change:** an ES module that no mock can reach is now a single
  instance for the life of the process, where it used to get a fresh one after
  every mock change
  * Module-level state in such a module (counters, caches, singletons) now
    persists between tests
  * Modules that are mocked, or that depend on a mock, are still re-evaluated
    against each new mock

# 0.10.1

* Stop emitting `[DEP0205] module.register() is deprecated` on Node.js 26+
  * On Node 26 and later, quibble now registers its ES module hooks with
    `module.registerHooks()` (synchronous, in-thread) instead of
    `module.register()`
  * Earlier versions are unchanged and keep using `module.register()`. Node
    versions from 22.15 through 22.22, 23.x, and 24.0 through 24.11 have
    `registerHooks`, but it can't be combined with an off-thread loader (e.g.
    `--loader`, tsx, ts-node) when ESM imports CommonJS, so quibble avoids it
    there
  * `canRegisterLoader()` now also returns true on a Node that only has
    `registerHooks`

# 0.10.0

* Add initial TypeScript type definitions (`index.d.ts`)
* Add support for Node.js 22 and 24
  * Fix ESM loader leaking a `?__quibble=N` query string on Node 22+, which could
    cause stub substitutions to silently miss

# 0.9.2

* Fix loader stomping on other loaders [#108](https://github.com/testdouble/quibble/pull/108)

# …

We failed to update the CHANGELOG much

# 0.7.0

Add support for Node 20. [#96](https://github.com/testdouble/quibble/pull/96)

# 0.6.17

* Allow proxy as a default export
  [#93](https://github.com/testdouble/quibble/pull/93)

# 0.6.16

* Improve Windows support
* Update dependencies

# 0.6.15

* Make sure the isLoaded state is explicitly set through the NodeJS loader
  life-cycle [#80](https://github.com/testdouble/quibble/pull/80)

# 0.0.1 … 0.6.14

* Everything
