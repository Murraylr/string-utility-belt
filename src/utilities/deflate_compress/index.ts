import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

type Fflate = typeof import('fflate')
let _fflate: Fflate | null = null
const getFflate = async (): Promise<Fflate> => {
  if (!_fflate) _fflate = await import('fflate')
  return _fflate
}

type Level = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

/** Read the `level` param: blank falls back to 6, anything outside 0-9 is a user error. */
function resolveLevel(raw: unknown): Level {
  if (raw === undefined || raw === null || raw === '') return 6
  const n = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isInteger(n) || n < 0 || n > 9) {
    throw new Error('level must be a whole number between 0 (store) and 9 (best)')
  }
  return n as Level
}

function toBytes(input: unknown): Uint8Array {
  if (isBytes(input)) return input
  return new TextEncoder().encode(input === null || input === undefined ? '' : String(input))
}

const util: Utility = {
  id: 'deflate_compress',
  name: 'deflate compress',
  category: 'Compression',
  description:
    'Compress text or bytes with DEFLATE, either zlib-wrapped (RFC 1950) or raw, at a level from 0 (store) to 9 (smallest).',
  accepts: ['string', 'bytes'],
  produces: 'bytes',
  tags: ['deflate', 'compress', 'zlib', 'compression', 'rfc 1950'],
  examples: [
    {
      title: 'zlib-wrapped compression',
      input: 'Hello, DEFLATE!',
      params: { format: 'zlib', level: 6 },
      outputMatches:
        '^bytes\\[120, 156, 243, 72, 205, 201, 201, 215, 81, 112, 113, 117, 243, 113, 12, 113, 85, 04, 00, 37, 196, 04, 87\\]\\nhex: \\[78, 9c, f3, 48, cd, c9, c9, d7, 51, 70, 71, 75, f3, 71, 0c, 71, 55, 04, 00, 25, c4, 04, 57\\]'
    }
  ],
  params: {
    format: { kind: 'select', label: 'format', options: ['raw', 'zlib'], default: 'zlib' },
    level: { kind: 'number', label: 'level (0-9)', default: 6, min: 0, max: 9, integer: true }
  },
  async apply(input: any, params: any): Promise<Uint8Array> {
    const format = params?.format === 'raw' ? 'raw' : 'zlib'
    const level = resolveLevel(params?.level)
    const bytes = toBytes(input)
    // Empty in, empty out — never emit a bare header for nothing.
    if (bytes.length === 0) return new Uint8Array(0)
    const { deflateSync, zlibSync } = await getFflate()
    return format === 'raw' ? deflateSync(bytes, { level }) : zlibSync(bytes, { level })
  }
}

export default util
