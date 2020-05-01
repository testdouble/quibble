'use strict'

module.exports = async function () {
  return import('./a-module-ignored.mjs')
}
