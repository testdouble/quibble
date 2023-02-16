const Module = require('module')
const path = require('path')
const util = require('util')
const { URL } = require('url')
const resolve = require('resolve')
const isPlainObject = require('lodash/isPlainObject.js')
const _ = {
  compact: require('lodash/fp/compact'),
  extendAll: require('lodash/fp/extendAll'),
  filter: require('lodash/fp/filter'),
  find: require('lodash/fp/find'),
  ooFind: require('lodash/find'),
  flow: require('lodash/fp/flow'),
  invokeMap: require('lodash/fp/invokeMap'),
  map: require('lodash/fp/map'),
  includes: require('lodash/fp/includes'),
  reject: require('lodash/fp/reject'),
  startsWith: require('lodash/fp/startsWith'),
  uniq: require('lodash/uniq'),
  tap: require('lodash/tap'),
  values: require('lodash/values')
}
let importFunctionsModule

const originalLoad = Module._load
let config = null
let quibbles = {}
let ignoredCallerFiles = []
let quibble

module.exports = quibble = function (request, stub) {
  request = quibble.absolutify(request)
  Module._load = fakeLoad
  quibbles[request] = {
    callerFile: hackErrorStackToGetCallerFile(),
    stub: arguments.length < 2 ? config.defaultFakeCreator(request) : stub
  }

  return quibbles[request].stub
}

quibble.config = function (userConfig) {
  return (config = _.extendAll({}, {
    defaultFakeCreator: function (request) { return {} }
  }, userConfig))
}

config = quibble.config()

quibble.ignoreCallsFromThisFile = function (file) {
  if (file == null) {
    file = hackErrorStackToGetCallerFile(false)
  }
  ignoredCallerFiles = _.uniq(ignoredCallerFiles.concat(file))
}

quibble.reset = function (hard) {
  Module._load = originalLoad
  quibbles = {}

  if (global.__quibble) {
    delete global.__quibble.quibbledModules
  }

  config = quibble.config()
  if (hard) {
    ignoredCallerFiles = []
  }
}

quibble.absolutify = function (relativePath, parentFileName) {
  if (parentFileName == null) {
    parentFileName = hackErrorStackToGetCallerFile()
  }
  const absolutePath = absolutePathFor(relativePath, parentFileName)
  const resolvedPath = nodeResolve(absolutePath, { basedir: path.dirname(parentFileName) })
  return resolvedPath || absolutePath
}

quibble.esm = async function (importPath, namedExportStubs, defaultExportStub) {
  checkThatLoaderIsLoaded()

  if (namedExportStubs != null && !util.types.isProxy(namedExportStubs) && !isPlainObject(namedExportStubs)) {
    throw new Error('namedExportsStub argument must be either a plain object or null/undefined')
  }

  let finalNamedExportStubs = namedExportStubs

  if (finalNamedExportStubs != null && 'default' in finalNamedExportStubs) {
    if (defaultExportStub !== undefined) {
      throw new Error("conflict between a named export with the name 'default' and the default export stub. You can't have both")
    }
    finalNamedExportStubs = { ...namedExportStubs }
    defaultExportStub = namedExportStubs.default
    delete finalNamedExportStubs.default
  }

  if (!global.__quibble.quibbledModules) {
    global.__quibble.quibbledModules = new Map()
  }
  ++global.__quibble.stubModuleGeneration
  importFunctionsModule = importFunctionsModule || require('./esm-import-functions')

  const importPathIsBareSpecifier = isBareSpecifier(importPath)
  const isAbsolutePath = path.isAbsolute(importPath)

  let callerFile
  if (!isAbsolutePath && !importPathIsBareSpecifier) {
    callerFile = hackErrorStackToGetCallerFile()
    if (process.platform === 'win32' && callerFile[0] === '/') {
      callerFile = callerFile.substring(1)
    }
  }

  const modulePath = importPathIsBareSpecifier
    ? await importFunctionsModule.dummyImportModuleToGetAtPath(importPath)
    : isAbsolutePath
      ? importPath
      : (path.resolve(path.dirname(callerFile), importPath))
  const fullModulePath = process.platform !== 'win32' ? modulePath : (modulePath.match(/^[a-zA-Z]:/) ? '/' : '') + modulePath.split(path.sep).join('/')

  global.__quibble.quibbledModules.set(fullModulePath, {
    defaultExportStub,
    namedExportStubs: finalNamedExportStubs
  })
}

quibble.isLoaderLoaded = function () {
  return !!global.__quibble
}

quibble.esmImportWithPath = async function esmImportWithPath (importPath) {
  checkThatLoaderIsLoaded()

  importFunctionsModule = importFunctionsModule || require('./esm-import-functions')

  const importPathIsBareSpecifier = isBareSpecifier(importPath)
  const isAbsolutePath = path.isAbsolute(importPath)
  let callerFile
  if (!isAbsolutePath && !importPathIsBareSpecifier) {
    callerFile = hackErrorStackToGetCallerFile()
    if (process.platform === 'win32' && callerFile[0] === '/') {
      callerFile = callerFile.substring(1)
    }
  }

  const modulePath = importPathIsBareSpecifier
    ? await importFunctionsModule.dummyImportModuleToGetAtPath(importPath)
    : isAbsolutePath
      ? importPath
      : (path.resolve(path.dirname(callerFile), importPath))
  const fullImportPath = importPathIsBareSpecifier
    ? importPath
    : (process.platform !== 'win32' ? modulePath : (modulePath.match(/^[a-zA-Z]:/) ? '/' : '') + modulePath.split(path.sep).join('/'))

  return {
    modulePath,
    module: await importFunctionsModule.importOriginalModule(fullImportPath)
  }
}

const absolutePathFor = function (relativePath, parentFileName) {
  if (_.startsWith(relativePath, '/') || /^(\w|@)/.test(relativePath)) {
    return relativePath
  } else {
    return path.resolve(path.dirname(parentFileName), relativePath)
  }
}

const fakeLoad = function (request, parent, isMain) {
  if (parent != null) {
    request = quibble.absolutify(request, parent.filename)
  }
  const stubbing = stubbingThatMatchesRequest(request)

  if (stubbing) {
    return stubbing.stub
  } else if (requireWasCalledFromAFileThatHasQuibbledStuff()) {
    return doWithoutCache(request, parent, function () {
      return originalLoad(request, parent, isMain)
    })
  } else {
    return originalLoad(request, parent, isMain)
  }
}
const stubbingThatMatchesRequest = function (request) {
  return _.ooFind(quibbles, function (stubbing, stubbedPath) {
    if (request === stubbedPath) return true
    if (nodeResolve(request) === stubbedPath) return true
  }, quibbles)
}

const requireWasCalledFromAFileThatHasQuibbledStuff = function () {
  const quibbleValues = _.values(quibbles)
  for (let i = 0; i < quibbleValues.length; i++) {
    if (quibbleValues[i].callerFile === hackErrorStackToGetCallerFile()) {
      return true
    }
  }
}

const doWithoutCache = function (request, parent, thingToDo) {
  const filename = Module._resolveFilename(request, parent)
  if (Object.prototype.hasOwnProperty.call(Module._cache, filename)) {
    return doAndRestoreCache(filename, thingToDo)
  } else {
    return doAndDeleteCache(filename, thingToDo)
  }
}

const doAndRestoreCache = function (filename, thingToDo) {
  const cachedThing = Module._cache[filename]
  delete Module._cache[filename]
  return _.tap(thingToDo(), function () {
    Module._cache[filename] = cachedThing
  })
}

const doAndDeleteCache = function (filename, thingToDo) {
  return _.tap(thingToDo(), function () {
    delete Module._cache[filename]
  })
}

const nodeResolve = function (request, options) {
  try {
    return resolve.sync(request, options)
  } catch (e) {}
}

const hackErrorStackToGetCallerFile = function (includeGlobalIgnores) {
  if (includeGlobalIgnores == null) {
    includeGlobalIgnores = true
  }
  const originalFunc = Error.prepareStackTrace
  const originalStackTraceLimit = Error.stackTraceLimit
  try {
    Error.stackTraceLimit = Math.max(Error.stackTraceLimit, 30)
    Error.prepareStackTrace = function (e, stack) {
      return stack
    }
    const e = new Error()
    const currentFile = convertUrlToPath(e.stack[0].getFileName())
    return _.flow([
      _.invokeMap('getFileName'),
      _.compact,
      _.map(convertUrlToPath),
      _.reject(function (f) {
        return includeGlobalIgnores && _.includes(f, ignoredCallerFiles)
      }),
      _.filter(path.isAbsolute),
      _.find(function (f) {
        return f !== currentFile
      })
    ])(e.stack)
  } finally {
    Error.prepareStackTrace = originalFunc
    Error.stackTraceLimit = originalStackTraceLimit
  }
}

function checkThatLoaderIsLoaded () {
  if (!global.__quibble) {
    throw new Error('quibble loader not loaded. You cannot replace ES modules without a loader. Run node with `--loader=quibble`.')
  }
}

function convertUrlToPath (fileUrl) {
  try {
    const p = fileUrl.match(/^[a-zA-Z]:/) ? fileUrl : new URL(fileUrl).pathname
    return p
  } catch (error) {
    if (error.code === 'ERR_INVALID_URL') {
      return fileUrl
    } else {
      throw error
    }
  }
}

function isBareSpecifier (modulePath) {
  const firstLetter = modulePath[0]
  if (firstLetter === '.' || firstLetter === '/') {
    return false
  }

  if (!modulePath.includes(':')) {
    return true
  }

  try {
    // (yes, we DO use new for side-effects!)
    // eslint-disable-next-line
    new URL(modulePath)
  } catch (error) {
    if (error.code === 'ERR_INVALID_URL') {
      return false
    } else {
      throw error
    }
  }

  return true
}
