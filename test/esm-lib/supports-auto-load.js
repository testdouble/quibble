const { canRegisterLoader } = require('../../lib/canRegisterLoader.js')

process.exit(canRegisterLoader() ? 0 : 1)
