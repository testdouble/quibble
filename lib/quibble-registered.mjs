import { globalPreload } from './quibble.mjs'
export * from './quibble.mjs'

export function initialize ({ port }) {
  globalPreload({ port })
}
