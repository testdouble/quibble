# Unreleased

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
