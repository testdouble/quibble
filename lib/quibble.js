var Module = require('module')
var path = require('path')
var { URL } = require('url')
var resolve = require('resolve')
var _ = {
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

var originalLoad = Module._load
var config = null
var quibbles = {}
var ignoredCallerFiles = []
var quibble

module.exports = quibble = function (request, stub, esmDefaultExportStub) {
  request = quibble.absolutify(request)
  Module._load = fakeLoad
  quibbles[request] = {
    callerFile: hackErrorStackToGetCallerFile(),
    stub: arguments.length < 2 ? config.defaultFakeCreator(request) : stub
  }

  if (arguments.length >= 2) {
    quibbleEsm(request, stub, esmDefaultExportStub)
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
  var absolutePath = absolutePathFor(relativePath, parentFileName)
  var resolvedPath = nodeResolve(absolutePath)
  return resolvedPath || absolutePath
}

function quibbleEsm (request, namedExportStubs, defaultExportStub) {
  var fullModulePath = request.startsWith('.')
    ? path.resolve(path.dirname(hackErrorStackToGetCallerFile()), request)
    : request.startsWith('/')
      ? request
      : request.startsWith('file://')
        ? convertUrlToPath(request)
        // This is SO wrong (CJS and ESM resolution are slighly different).
        // But we'll leave it here for future change to an algorithm that supports ESM
        : nodeResolve(request)

  if (!global.__quibble) {
    global.__quibble = { stubModuleGeneration: 1, quibbledModules: new Map() }
  } else if (!global.__quibble.quibbledModules) {
    global.__quibble.quibbledModules = new Map()
    ++global.__quibble.stubModuleGeneration
  }

  global.__quibble.quibbledModules.set(fullModulePath, {
    defaultExportReplacement: defaultExportStub,
    namedExportReplacements: namedExportStubs
  })
}

var absolutePathFor = function (relativePath, parentFileName) {
  if (_.startsWith(relativePath, '/') || /^(\w|@)/.test(relativePath)) {
    return relativePath
  } else {
    return path.resolve(path.dirname(parentFileName), relativePath)
  }
}

var fakeLoad = function (request, parent, isMain) {
  if (parent != null) {
    request = quibble.absolutify(request, parent.filename)
  }
  var stubbing = stubbingThatMatchesRequest(request)

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
var stubbingThatMatchesRequest = function (request) {
  return _.ooFind(quibbles, function (stubbing, stubbedPath) {
    if (request === stubbedPath) return true
    if (nodeResolve(request) === stubbedPath) return true
  }, quibbles)
}

var requireWasCalledFromAFileThatHasQuibbledStuff = function () {
  const quibbleValues = _.values(quibbles)
  for (var i = 0; i < quibbleValues.length; i++) {
    if (quibbleValues[i].callerFile === hackErrorStackToGetCallerFile()) {
      return true
    }
  }
}

var doWithoutCache = function (request, parent, thingToDo) {
  var filename = Module._resolveFilename(request, parent)
  if (Object.prototype.hasOwnProperty.call(Module._cache, filename)) {
    return doAndRestoreCache(filename, thingToDo)
  } else {
    return doAndDeleteCache(filename, thingToDo)
  }
}

var doAndRestoreCache = function (filename, thingToDo) {
  var cachedThing = Module._cache[filename]
  delete Module._cache[filename]
  return _.tap(thingToDo(), function () {
    Module._cache[filename] = cachedThing
  })
}

var doAndDeleteCache = function (filename, thingToDo) {
  return _.tap(thingToDo(), function () {
    delete Module._cache[filename]
  })
}

var nodeResolve = function (request) {
  try {
    return resolve.sync(request)
  } catch (e) {}
}

var hackErrorStackToGetCallerFile = function (includeGlobalIgnores) {
  if (includeGlobalIgnores == null) {
    includeGlobalIgnores = true
  }
  var originalFunc = Error.prepareStackTrace
  try {
    Error.prepareStackTrace = function (e, stack) {
      return stack
    }
    var e = new Error()
    var currentFile = convertUrlToPath(e.stack[0].getFileName())
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
  }
}

function convertUrlToPath (fileUrl) {
  try {
    const p = new URL(fileUrl).pathname
    return p
  } catch (error) {
    if (error.code === 'ERR_INVALID_URL') {
      return fileUrl
    } else {
      throw error
    }
  }
}
