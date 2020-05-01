import { ignoreCallsFromThisFile } from '../../lib/quibble.mjs'
export const life = 42
export const namedExport = 'named-export'

ignoreCallsFromThisFile()

export default 'default-export'
