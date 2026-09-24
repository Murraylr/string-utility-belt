import { describe, expect, it } from 'vitest'
import { formatOffset, hexDumpRows } from './hex'

describe('hexDumpRows', () => {
  it('groups 16 bytes per row with hex and ascii columns', () => {
    const bytes = new Uint8Array(Array.from({ length: 18 }, (_, i) => i))
    const rows = hexDumpRows(bytes)
    expect(rows).toHaveLength(2)
    expect(rows[0].offset).toBe(0)
    expect(rows[0].hex).toBe('00 01 02 03 04 05 06 07 08 09 0a 0b 0c 0d 0e 0f')
    expect(rows[1].offset).toBe(16)
    expect(rows[1].hex).toBe('10 11')
  })

  it('renders printable ASCII and dots for everything else', () => {
    const bytes = new Uint8Array([0x41, 0x00, 0x7e, 0x7f])
    const [row] = hexDumpRows(bytes)
    // 0x41='A' printable, 0x00 -> '.', 0x7e='~' printable, 0x7f (DEL) -> '.'
    expect(row.ascii).toBe('A.~.')
  })

  it('honours start/end bounds (for capped previews)', () => {
    const bytes = new Uint8Array(Array.from({ length: 32 }, (_, i) => i))
    const rows = hexDumpRows(bytes, 0, 16)
    expect(rows).toHaveLength(1)
  })
})

describe('formatOffset', () => {
  it('zero-pads to 8 hex digits', () => {
    expect(formatOffset(0)).toBe('00000000')
    expect(formatOffset(255)).toBe('000000ff')
  })
})
