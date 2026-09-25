import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/** Bytes per visual group — an extra space is inserted at each boundary. */
const GROUP = 8
const MAX_WIDTH = 256

function toBytes(input: unknown): Uint8Array {
  if (isBytes(input)) return input as Uint8Array
  if (input === null || input === undefined) return new Uint8Array(0)
  if (typeof input === 'object') return new TextEncoder().encode(JSON.stringify(input))
  return new TextEncoder().encode(String(input))
}

/**
 * The params editor sends `''` for a number field the user has cleared, so an
 * empty value has to mean "use the default" rather than `Number('') === 0`.
 */
const numParam = (v: unknown, fallback: number) =>
  v === undefined || v === null || v === '' ? fallback : Number(v)

const hex2 = (n: number, upper: boolean) => {
  const h = n.toString(16).padStart(2, '0')
  return upper ? h.toUpperCase() : h
}

/** Fixed-width hex column, space-padded where the final row runs short. */
function hexColumn(bytes: Uint8Array, start: number, width: number, upper: boolean): string {
  let col = ''
  for (let i = 0; i < width; i++) {
    if (i > 0) col += i % GROUP === 0 ? '  ' : ' '
    const idx = start + i
    col += idx < bytes.length ? hex2(bytes[idx], upper) : '  '
  }
  return col
}

/** Printable ASCII passes through, everything else becomes a dot. */
function asciiColumn(bytes: Uint8Array, start: number, width: number): string {
  let out = ''
  for (let i = 0; i < width && start + i < bytes.length; i++) {
    const b = bytes[start + i]
    out += b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'
  }
  return out
}

const util: Utility = {
  id: 'hex_dump',
  name: 'hex dump',
  category: 'Analysis',
  description:
    'Render bytes as a hexdump -C style dump with a configurable row width, optional offsets, ASCII gutter and upper-case hex.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['hexdump', 'binary viewer', 'byte viewer', 'ascii gutter', 'hex editor'],
  aliases: ['xxd', 'od'],
  params: {
    width: { kind: 'number', label: 'bytes per row', default: 16, min: 1, max: MAX_WIDTH, integer: true },
    uppercase: { kind: 'boolean', label: 'uppercase hex', default: false },
    showAscii: { kind: 'boolean', label: 'show ascii', default: true },
    showOffset: { kind: 'boolean', label: 'show offset', default: true }
  },
  examples: [
    {
      title: 'a short string, 8 bytes per row',
      input: 'Hi!',
      params: { width: 8 },
      output: '00000000  48 69 21                 |Hi!|'
    }
  ],
  apply: (input: any, params: any) => {
    const rawWidth = numParam(params?.width, 16)
    if (!Number.isFinite(rawWidth) || rawWidth < 1 || rawWidth > MAX_WIDTH) {
      throw new Error(`width must be a number between 1 and ${MAX_WIDTH}`)
    }
    const width = Math.floor(rawWidth)
    const upper = params?.uppercase === true
    const showAscii = params?.showAscii !== false
    const showOffset = params?.showOffset !== false

    const bytes = toBytes(input)
    if (bytes.length === 0) return ''

    const lines: string[] = []
    for (let off = 0; off < bytes.length; off += width) {
      const offset = off.toString(16).padStart(8, '0')
      const prefix = showOffset ? `${upper ? offset.toUpperCase() : offset}  ` : ''
      const col = hexColumn(bytes, off, width, upper)
      lines.push(
        showAscii
          ? `${prefix}${col}  |${asciiColumn(bytes, off, width)}|`
          : `${prefix}${col.replace(/ +$/, '')}`
      )
    }
    return lines.join('\n')
  }
}

export default util
