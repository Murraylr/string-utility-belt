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
  id: 'gzip_compress',
  name: 'gzip compress',
  category: 'Compression',
  description:
    'Compress text or bytes into a gzip stream, with a compression level from 0 (store) to 9 (smallest).',
  accepts: ['string', 'bytes'],
  produces: 'bytes',
  tags: ['gzip', 'compress', 'compression', 'gz'],
  examples: [
    {
      title: 'compress to a gzip stream',
      input: 'Hello, gzip!',
      params: { level: 6 },
      outputMatches:
        '^bytes\\[31, 139, 08, 00, 00, 00, 00, 00, 00, 03, 243, 72, 205, 201, 201, 215, 81, 72, 175, 202, 44, 80, 04, 00, 62, 61, 15, 16, 12, 00, 00, 00\\]\\nhex: \\[1f, 8b, 08, 00, 00, 00, 00, 00, 00, 03, f3, 48, cd, c9, c9, d7, 51, 48, af, ca, 2c, 50, 04, 00, 3e, 3d, 0f, 10, 0c, 00, 00, 00\\]'
    }
  ],
  params: {
    level: { kind: 'number', label: 'level (0-9)', default: 6, min: 0, max: 9, integer: true }
  },
  async apply(input: any, params: any): Promise<Uint8Array> {
    const level = resolveLevel(params?.level)
    const bytes = toBytes(input)
    // Empty in, empty out — never emit a 20-byte header for nothing.
    if (bytes.length === 0) return new Uint8Array(0)
    const { gzipSync } = await getFflate()
    // mtime: 0 keeps output byte-for-byte deterministic and avoids leaking a timestamp.
    return gzipSync(bytes, { level, mtime: 0 })
  }
}

export default util
