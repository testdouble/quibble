import quibble from 'quibble'

const importSubject = () => import('../esm-fixtures/import-graph/subject.mjs')

export default {
  afterEach: function () { quibble.reset() },
  'a module that depends on a mock only through another module sees the mock': async function () {
    await quibble.esm('../esm-fixtures/import-graph/leaf.mjs', { thing: () => 'fake' })

    const subject = await importSubject()

    assert.equal(subject.run(), 'fake')
  },
  'each new mock is picked up by the modules that depend on it': async function () {
    for (const name of ['first', 'second', 'third', 'fourth', 'fifth']) {
      await quibble.esm('../esm-fixtures/import-graph/leaf.mjs', { thing: () => name })

      assert.equal((await importSubject()).run(), name)

      quibble.reset()
    }
  },
  'the real module comes back after a reset': async function () {
    await quibble.esm('../esm-fixtures/import-graph/leaf.mjs', { thing: () => 'fake' })
    await importSubject()
    quibble.reset()

    assert.equal((await importSubject()).run(), 'real')
  },
  'a module in the middle of a graph can be mocked': async function () {
    await quibble.esm('../esm-fixtures/import-graph/middle.mjs', { fromMiddle: () => 'middle fake' })

    assert.equal((await importSubject()).run(), 'middle fake')
  },
  'modules unrelated to any mock stop being re-evaluated for every new mock': async function () {
    const evaluations = []
    for (let i = 0; i < 8; i++) {
      await quibble.esm('../esm-fixtures/import-graph/leaf.mjs', { thing: () => `fake ${i}` })
      evaluations.push((await importSubject()).unrelatedEvaluation)
      quibble.reset()
    }

    // Each unrelated module may be evaluated once under the first (tagged)
    // URL it is loaded with and once more at its plain URL, but no more
    assert.ok(new Set(evaluations).size <= 2, `evaluated ${new Set(evaluations).size} times: ${evaluations}`)
    assert.equal(new Set(evaluations.slice(-3)).size, 1, `still changing: ${evaluations}`)
  },
  // These fixtures are only used here, so the subject really is first loaded
  // before any mock exists no matter what order the tests run in
  'a module imported before any mock exists still sees a mock added later': async function () {
    const subject = () => import('../esm-fixtures/import-graph-late-mock/subject.mjs')
    assert.equal((await subject()).run(), 'real')

    await quibble.esm('../esm-fixtures/import-graph-late-mock/leaf.mjs', { thing: () => 'fake' })

    assert.equal((await subject()).run(), 'fake')
  },
  // Separate fixtures again, so what each module has been used for before this
  // test is the same no matter what order the tests run in
  'a module that was only ever loaded as a mock stub does not hide later mocks of its dependencies': async function () {
    const subject = () => import('../esm-fixtures/import-graph-stub-first/subject.mjs')

    await quibble.esm('../esm-fixtures/import-graph-stub-first/middle.mjs', { fromMiddle: () => 'middle fake' })
    assert.equal((await subject()).run(), 'middle fake')
    quibble.reset()

    // The real middle module is loaded for the first time here, against a fake leaf
    await quibble.esm('../esm-fixtures/import-graph-stub-first/leaf.mjs', { thing: () => 'leaf fake' })
    assert.equal((await subject()).run(), 'leaf fake')
    quibble.reset()

    assert.equal((await subject()).run(), 'real')
  },
  'a module that does not exist can be mocked again by each new generation': async function () {
    for (const name of ['first', 'second', 'third', 'fourth']) {
      await quibble.esm('../esm-fixtures/import-graph-missing-module/does-not-exist.mjs', { ghost: () => name })

      assert.equal((await import('../esm-fixtures/import-graph-missing-module/importer.mjs')).run(), name)

      quibble.reset()
    }
  }
}
