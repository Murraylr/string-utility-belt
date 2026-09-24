/** Test fixtures shared by the worker's test files (not part of the Worker bundle). */

const URI_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$'

/**
 * A valid lz-string (URI-safe) payload of `codes` codes that each reference the entry
 * being created (w + w[0]) — the worst case, whose output grows quadratically.
 */
export function bombPayload(codes: number): string {
  const bits: number[] = []
  const put = (value: number, n: number) => { for (let i = 0; i < n; i++) bits.push((value >> i) & 1) }
  put(0, 2)
  put(97, 8) // literal "a"
  let dictSize = 4
  let enlargeIn = 4
  let numBits = 3
  for (let k = 0; k < codes; k++) {
    put(dictSize, numBits)
    dictSize++
    if (--enlargeIn === 0) enlargeIn = 2 ** numBits++
  }
  put(2, numBits)
  let out = ''
  for (let i = 0; i < bits.length; i += 6) {
    let v = 0
    for (let j = 0; j < 6; j++) v = (v << 1) | (bits[i + j] ?? 0)
    out += URI_SAFE[v]
  }
  return `${out}A`
}

/** Characters `bombPayload(codes)` decodes to. */
export const bombLength = (codes: number) => 1 + (codes * (codes - 1)) / 2 + 2 * codes

export const URI_SAFE_ALPHABET = URI_SAFE
