const Module = require('module')

function canRegisterLoader () {
  return typeof Module.registerHooks === 'function' ||
    typeof Module.register === 'function'
}

exports.canRegisterLoader = canRegisterLoader
