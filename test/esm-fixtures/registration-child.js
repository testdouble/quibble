// Run in a fresh Node process by quibble-loader-registration.test.js, without
// `--loader=quibble`, so quibble has to register its own hooks.
const quibble = require('../../lib/quibble')

;(async () => {
  await quibble.esm('./a-module.mjs', { life: 41 }, 'default-export-replacement')

  const stubbed = await import('./a-module.mjs')
  const requiredCjs = require('./a-cjs-module.cjs')
  const importedCjs = await import('./a-cjs-module.cjs')
  const requiredJson = require('../fixtures/a-function.json')

  quibble.reset()
  const restored = await import('./a-module.mjs')

  process.stdout.write(JSON.stringify({
    stubbedDefault: stubbed.default,
    stubbedLife: stubbed.life,
    requiredCjs: requiredCjs.answer,
    importedCjs: importedCjs.default.answer,
    requiredJson: typeof requiredJson,
    restoredDefault: restored.default,
    restoredLife: restored.life
  }))
})().catch(error => {
  console.error(error)
  process.exit(1)
})
