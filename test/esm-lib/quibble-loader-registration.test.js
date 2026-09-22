const path = require('path')
const { spawnSync } = require('child_process')
const { pathToFileURL } = require('url')
const { canRegisterLoader } = require('../../lib/canRegisterLoader')

const child = path.join(__dirname, '../esm-fixtures/registration-child.js')
const passthroughLoader = pathToFileURL(
  path.join(__dirname, '../esm-fixtures/passthrough-loader.mjs')
).href

function runChild (nodeArgs = []) {
  const { status, stdout, stderr } = spawnSync(
    process.execPath,
    [...nodeArgs, child],
    { encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '' } }
  )
  return { status, stderr, stdout, result: status === 0 ? JSON.parse(stdout) : null }
}

function assertStubbingAndCjsWork ({ status, stderr, result }) {
  assert.equal(status, 0, stderr)
  assert.deepEqual(result, {
    stubbedDefault: 'default-export-replacement',
    stubbedLife: 41,
    requiredCjs: 42,
    importedCjs: 42,
    requiredJson: 'object',
    restoredDefault: 'default-export',
    restoredLife: 42
  })
}

// These spawn fresh processes because the interesting behavior is what
// happens when quibble registers its own loader on first use.
module.exports = {
  'auto-registering the loader stubs ESM and leaves CJS require() alone': function () {
    if (!canRegisterLoader()) return

    assertStubbingAndCjsWork(runChild())
  },

  'auto-registering the loader does not emit a deprecation warning': function () {
    if (!canRegisterLoader()) return

    const { stderr } = runChild()

    assert.doesNotMatch(stderr, /DEP0\d+/)
    assert.doesNotMatch(stderr, /module\.register\(\) is deprecated/)
  },

  'auto-registering the loader works alongside another off-thread loader': function () {
    if (!canRegisterLoader()) return

    // Guards against Node versions where in-thread hooks and off-thread
    // loaders can't be mixed when ESM imports CJS (see shouldUseRegisterHooks)
    assertStubbingAndCjsWork(
      runChild(['--no-warnings', '--loader', passthroughLoader])
    )
  }
}
