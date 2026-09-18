global.assert = require('assert')

// Just in case we lose track of it somewhere
global.ORIGINAL_MODULE_LOAD = require('module')._load
