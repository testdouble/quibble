exports.thisWillRunInUserThread = (globalThis, port) => {
  globalThis[Symbol.for('__quibbleUserState')] = { quibbledModules: new Map() }

  globalThis[Symbol.for('__quibbleUserToLoaderCommunication')] = {
    reset () {
      globalThis[Symbol.for('__quibbleUserState')].quibbledModules = new Map()

      if (!loaderAndUserRunInSameThread(globalThis)) {
        const hasResetHappened = new Int32Array(new SharedArrayBuffer(4))
        port.postMessage({ type: 'reset', hasResetHappened })
        Atomics.wait(hasResetHappened, 0, 0)
      } else {
        const quibbleLoaderState = globalThis[Symbol.for('__quibbleLoaderState')]

        quibbleLoaderState.quibbledModules = new Map()
        quibbleLoaderState.stubModuleGeneration++
      }
    },
    addMockedModule (
      moduleUrl,
      { namedExportStubs, defaultExportStub }
    ) {
      globalThis[Symbol.for('__quibbleUserState')].quibbledModules.set(moduleUrl, {
        defaultExportStub,
        namedExportStubs
      })

      if (!loaderAndUserRunInSameThread(globalThis)) {
        const hasAddMockedHappened = new Int32Array(new SharedArrayBuffer(4))

        port.postMessage({
          type: 'addMockedModule',
          moduleUrl,
          namedExports: Object.keys(namedExportStubs || []),
          hasDefaultExport: defaultExportStub != null,
          hasAddMockedHappened
        })
        Atomics.wait(hasAddMockedHappened, 0, 0)
      } else {
        const quibbleLoaderState = globalThis[Symbol.for('__quibbleLoaderState')]

        quibbleLoaderState.quibbledModules.set(moduleUrl, {
          hasDefaultExport: defaultExportStub != null,
          namedExports: Object.keys(namedExportStubs || [])
        })
        ++quibbleLoaderState.stubModuleGeneration
      }
    },
    listMockedModules () {
      if (!loaderAndUserRunInSameThread(globalThis)) {
        const hasListMockedModulesHappened = new Int32Array(new SharedArrayBuffer(4))
        const mockedModulesListLength = new Int32Array(new SharedArrayBuffer(4))
        const mockedModulesList = new Uint8Array(new SharedArrayBuffer(20 * 1024 * 1024)) // 20MB should be sufficient
        port.postMessage({
          type: 'listMockedModules',
          hasListMockedModulesHappened,
          mockedModulesListLength,
          mockedModulesList
        })
        Atomics.wait(hasListMockedModulesHappened, 0, 0)
        if (mockedModulesListLength[0] > mockedModulesList.length) {
          throw new Error('Not enough buffer allocated for result')
        }
        const serializedMockedModules = new TextDecoder().decode(mockedModulesList.slice(0, mockedModulesListLength[0]))
        return serializedMockedModules ? serializedMockedModules.split(' ') : []
      } else {
        const quibbleLoaderState = globalThis[Symbol.for('__quibbleLoaderState')]

        return Array.from(quibbleLoaderState.quibbledModules.keys())
      }
    }
  }

  function loaderAndUserRunInSameThread (globalThis) {
    return !!globalThis[Symbol.for('__quibbleLoaderState')]
  }
}
