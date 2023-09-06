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
    async addMockedModule (
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
    }
  }

  function loaderAndUserRunInSameThread (globalThis) {
    return !!globalThis[Symbol.for('__quibbleLoaderState')]
  }
}
