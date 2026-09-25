import type { UtilityExample, Value } from '../types/utility'

/** A worked example's input as the utility receives it (`inputEncoding` decoded). Shared by the golden tests. */
export function decodeExampleInput(ex: UtilityExample): Value {
  switch (ex.inputEncoding ?? 'text') {
    case 'hex': {
      const clean = ex.input.replace(/\s+/g, '')
      return Uint8Array.from(clean.match(/../g) ?? [], h => parseInt(h, 16))
    }
    case 'base64':
      return Uint8Array.from(atob(ex.input), c => c.charCodeAt(0))
    case 'json':
      return JSON.parse(ex.input)
    default:
      return ex.input
  }
}
