// Only ever imported by the test that quibbles its dependency, so that
// import() is what first loads it
module.exports = { dependency: require('./a-cjs-dependency.cjs') }
