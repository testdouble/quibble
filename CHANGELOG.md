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
