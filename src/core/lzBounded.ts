/**
 * lz-string's `decompressFromEncodedURIComponent`, with a ceiling on the output.
 *
 * lz-string is LZW-like: every code may reference the entry created just before it,
 * so n codes can expand to about n²/2 characters. A 20 KB link of "aaaa…" decodes to
 * 50 million characters; a slightly longer one exhausts memory. Share links are
 * untrusted input, so every host decodes them through this bounded version, which
 * gives up as soon as the output passes `maxChars`.
 */

export class ShareTooLargeError extends Error {
  readonly limit: number
  constructor(limit: number) {
    super(`This link is too large to open safely (it expands to more than ${limit.toLocaleString('en-US')} characters).`)
    this.limit = limit
  }
}

const URI_SAFE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$'
/** Character code → 6-bit value; characters outside the alphabet read as 0, as in lz-string. */
const VALUE = new Uint8Array(128)
for (let i = 0; i < URI_SAFE.length; i++) VALUE[URI_SAFE.charCodeAt(i)] = i

const RESET = 32

/**
 * Inverse of `LZString.compressToEncodedURIComponent`, or null/'' where lz-string
 * would return them for corrupt input. Throws ShareTooLargeError past `maxChars`.
 */
export function decompressUriSafe(encoded: string, maxChars: number): string | null {
  const input = encoded.replace(/ /g, '+')
  if (input === '') return null
  const at = (i: number) => {
    const c = input.charCodeAt(i)
    return c < 128 ? VALUE[c] : 0
  }

  let val = at(0)
  let position = RESET
  let index = 1
  const read = (n: number): number => {
    let bits = 0
    for (let power = 1, i = 0; i < n; i++, power *= 2) {
      const bit = val & position
      position >>= 1
      if (position === 0) {
        position = RESET
        val = at(index++)
      }
      if (bit) bits += power
    }
    return bits
  }

  const dictionary: string[] = []
  let dictSize = 4
  let enlargeIn = 4
  let numBits = 3

  let w: string
  switch (read(2)) {
    case 0: w = String.fromCharCode(read(8)); break
    case 1: w = String.fromCharCode(read(16)); break
    case 2: return ''
    default: return null
  }
  dictionary[3] = w
  const result = [w]
  let total = 1

  for (;;) {
    if (index > input.length) return ''
    let code = read(numBits)
    if (code === 0 || code === 1) {
      dictionary[dictSize++] = String.fromCharCode(read(code === 0 ? 8 : 16))
      code = dictSize - 1
      if (--enlargeIn === 0) enlargeIn = 2 ** numBits++
    } else if (code === 2) {
      return result.join('')
    }

    let entry: string
    if (dictionary[code] !== undefined) entry = dictionary[code]
    else if (code === dictSize) entry = w + w.charAt(0)
    else return null

    total += entry.length
    if (total > maxChars) throw new ShareTooLargeError(maxChars)
    result.push(entry)

    dictionary[dictSize++] = w + entry.charAt(0)
    w = entry
    if (--enlargeIn === 0) enlargeIn = 2 ** numBits++
  }
}
