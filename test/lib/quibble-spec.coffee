quibble = require('../../lib/quibble')

describe 'quibble', ->

  describe '.config', ->
    describe 'defaultFakeCreator', ->
      Given -> quibble.config(defaultFakeCreator: -> 'lol')
      When -> quibble('./lol')
      Then -> require('./lol') == 'lol'


  afterEach -> quibble.reset()

