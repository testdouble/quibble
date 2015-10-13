global.expect = require('chai').expect
global.context = describe
global.xThen = ->

afterEach -> require('../lib/quibble').reset()

