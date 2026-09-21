import quibble from 'quibble'

export { quibble }

export async function setup () {
  await quibble.esm('../lib/animals/bear.mjs', undefined, function () { return 'a fake bear' })
  await quibble.esm('../lib/animals/lion.mjs', { default: function () { return 'a fake lion' } })
}

export function teardown () {
  quibble.reset()
}
