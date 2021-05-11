# quibble

[![Build Status](https://travis-ci.org/testdouble/quibble.svg?branch=main)](https://travis-ci.org/testdouble/quibble)

Quibble is a terser (and more magical) alternative to packages like
[proxyquire](https://github.com/thlorenz/proxyquire),
[sandboxed-module](https://github.com/felixge/node-sandboxed-module) and
[mockery](https://github.com/mfncooper/mockery) for mocking out dependencies
in tests of Node.js modules. Using `quibble` you can replace
how `require()` will behave for a given path. Its intended use is squarely
focused on unit testing. It is almost-but-not-quite a private dependency of
[testdouble.js](https://github.com/testdouble/testdouble.js), as it
implements the `td.replace()` function's module-replacement behavior.

## Usage

Say we're testing pants:

```js
quibble = require('quibble')

describe('pants', function(){
  var subject, legs;
  beforeEach(function(){
    legs = quibble('./../lib/legs', function(){ return 'a leg';});

    subject = require('./../lib/pants');
  });
  it('contains legs', function() {
    expect(subject().left).toContain('a leg')
    expect(subject().right).toContain('a leg')
  })
});
```

That way, when the `subject` loaded from `lib/pants` runs `require('./legs')`,
it will get back the function that returns `'a leg'`. The fake value is also
returned by `quibble`, which makes it easy to set and assign a test double in a
one-liner.

For more info on how this module is _really_ intended to be used, check out its
inclusion in [testdouble.js](https://github.com/testdouble/testdouble.js/blob/main/docs/7-replacing-dependencies.md#nodejs)

## Configuration

There's only one option: what you want to do with quibbled modules by default.

Say you're pulling in [testdouble.js](https://github.com/testdouble/testdouble.js)
and you want every quibbled module to default to a single test double function with
a name that matches its absolute path. You could do this:

```js
quibble = require('quibble')
beforeEach(function(){
  quibble.config({
    defaultFakeCreator: function(path) {
      return require('testdouble').create(path);
    }
  });
});
```

With this set up, running `quibble('./some/path')` will default to replacing all
`require('../anything/that/matches/some/path')` invocations with a test double named
after the absolute path resolved to by `'./some/path'`.

Spiffy!

> Note: `defaultFakeCreator` is not supported for ES Module stubbing

## ES Modules support

Quibble supports ES Modules. Quibble implements ES module support using [ES Module
Loaders](https://nodejs.org/api/esm.html#esm_experimental_loaders) which are the official way to
"patch" Node.js' module loading mechanism for ESM.

> Note that Loader support is currently experimental and unstable. We will be doing our best
  to track the changes in the specification for the upcoming Node.js versions. Also note that
  Quibble ESM support is tested only for versions 13 and above.

To use Quibble support, you must run Node with the `quibble` package as the loader:

```sh
node --loader=quibble ...
```

Most test runners allow you to specify this in their command line, e.g. for Mocha:

```sh
mocha --loader=quibble ...
```

The `quibble` loader will enable the replacement of the ES modules with the stubs you specify, and
without it, the stubbing will be ignored.

### Restrictions on ESM

* `defaultFakeCreator` is not yet supported.

### `quibble` ESM API

The API is similar to the CommonJS API, but uses `quibble.esm` function, and is async:

```js
// a-module.mjs (ESM)
export const life = 42;
export default 'universe';

// uses-a-module.mjs
import universe, {life} from './a-module.mjs';

console.log(life, universe);

(async function () {
  await quibble.esm('./a-module.mjs', {life: 41}, 'replacement universe');

  await import('./uses-some-module.mjs');
  // ==> logs: 41, replacement universe
})();
```

The parameters to `quibble` for ESM modules are:

1. the module path: similar to CommonJS, the path is relative to the directory you are in. It is
   resolved the ESM way, so if you're using a relative path, you must specify the filename,
   including the extension.

* `quibble.reset` works the same as for CommonJS modules

ESM support also exposes the function `quibble.esmImportWithPath` which both imports a module and
resolves the path to the module that is the package's entry point:

* `async quibble.esmImportWithPath(importPath)`: imports a module, just like `import(importPath)`,
  but returns an object with two properties:
  * `module`: the module returned by `await import(importPath)`.
  * `modulePath`: the full path to the module (file) that is the entry point to the package/module.
  
> Note that when mocking internal Node.js modules (e.g. "[fs](https://nodejs.org/api/fs.html)")), you need to mock the named exports both as named exports and as properties in the default export, because Node.js exports internal modules both as named exports and as a default object. Example:

```js
const fsExports = {
  readFileSync: function (path) {
    console.log("using quibbled readFileSyns... yay!");
    return "Looks like 'fs' was replaced correctly.";
  },
}
await quibble.esm("fs", fsExports, fsExports);
```

## How's it different?

A few things that stand out about quibble:

1. No partial mocking, as proxyquire does. [Partial Mocks](https://github.com/testdouble/contributing-tests/wiki/Partial-Mock)
are often seen problematic and not helpful for unit testing designed to create clear boundaries
between the SUT and its dependencies
2. Global replacements, so it's easy to set up a few arrange steps in advance of
instantiating your subject (using `require` just as you normally would). The instantiation
style of other libs is a little different (e.g. `require('./my/subject', {'/this/thing': stub})`
3. Require strings are resolved to absolute paths. It can be a bit confusing using other tools because from the perspective of the test particular paths are knocked out _from the perspective of the subject_ and not from the test listing, which runs counter to how every other Node.js API works. Instead, here, the path of the file being knocked out is relative to whoever is knocking it out.
4. A configurable default faker function. This lib was written to support the [testdouble.js](https://github.com/testdouble/testdouble.js) feature [td.replace()](https://github.com/testdouble/testdouble.js/blob/main/docs/7-replacing-dependencies.md#nodejs), in an effort to reduce the amount of per-test friction to repetitively create & pass in test doubles
5. A `reset()` method that undoes everything, intended to be run `afterEach` test runs


