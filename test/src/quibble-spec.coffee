originalLoad = require('module')._load
quibble = require('../../src/quibble')

describe 'quibble', ->
  describe 'basic behavior', ->
    Given -> @stubbing = quibble('./../fixtures/a-function', -> "kek")
    Then -> @stubbing() == "kek"
    Then -> require('./../fixtures/a-function')() == "kek"
    Then -> require('../fixtures/a-function')() == "kek"
    Then -> require('../../test/fixtures/a-function')() == "kek"
    Then -> require('./../fixtures/b-function')() == "b function"

  describe '.config', ->
    describe 'defaultFakeCreator', ->
      Given -> quibble.config(defaultFakeCreator: -> 'lol')
      When -> @stubbing = quibble('./lol')
      Then -> @stubbing == 'lol'
      Then -> require('./../../test/lib/lol') == 'lol'

  describe '.reset', ->
    context 'ensure it clears its internal data structure of quibbles', ->
      Given -> quibble('./../fixtures/a-function', -> "ha")
      Given -> quibble.reset()
      When -> quibble('./some-other-thing')
      Then -> require('../fixtures/a-function')() == "the real function"

    context 'without a reset', ->
      Given -> quibble('./../fixtures/a-function', -> "ha")
      When -> quibble('./some-other-thing')
      Then -> require('../fixtures/a-function')() == "ha"

  describe 'blowing the require cache', ->
    context 'requiring-an-already-cached-thing and then quibbling it', ->
      Given -> requiresAFunction = require('../fixtures/requires-a-function')
      Given -> quibble('./../fixtures/a-function', -> 'a fake function')
      Given -> @quibbledRequiresAFunction = require('../fixtures/requires-a-function')
      When -> @result = @quibbledRequiresAFunction()
      Then -> @result == "loaded a fake function"

describe 'quibble.reset', ->
  describe 'restores original require', ->
    Given -> # The above example group calls quibble.reset()
    Then -> require('module')._load == originalLoad
