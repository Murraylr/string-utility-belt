/** Hex-dump formatting: offset | hex bytes | ascii, 16 bytes per row. */

export interface HexRow {
  offset: number
  hex: string
  ascii: string
}

export function hexDumpRows(bytes: Uint8Array, start = 0, end = bytes.length, bytesPerRow = 16): HexRow[] {
  const rows: HexRow[] = []
  for (let i = start; i < end; i += bytesPerRow) {
    const slice = bytes.subarray(i, Math.min(i + bytesPerRow, end))
    const hex = Array.from(slice).map(b => b.toString(16).padStart(2, '0')).join(' ')
    const ascii = Array.from(slice).map(b => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.')).join('')
    rows.push({ offset: i, hex, ascii })
  }
  return rows
}

export function formatOffset(offset: number): string {
  return offset.toString(16).padStart(8, '0')
}
