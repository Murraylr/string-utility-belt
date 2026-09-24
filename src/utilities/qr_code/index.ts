import type { Utility, Value } from '@/types/utility'

/* -------------------------------------------------------------------------- */
/* dependency (dynamic + cached — never a top-level import)                    */
/* -------------------------------------------------------------------------- */

type QrFactory = typeof import('qrcode-generator')
type QrCode = ReturnType<QrFactory>

let _qrcode: QrFactory | null = null

async function getQrcode(): Promise<QrFactory> {
  if (!_qrcode) {
    const mod = await import('qrcode-generator')
    _qrcode = (mod as unknown as { default?: QrFactory }).default ?? (mod as unknown as QrFactory)
  }
  return _qrcode
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

const LEVELS = ['L', 'M', 'Q', 'H'] as const
type Level = (typeof LEVELS)[number]

const OUTPUTS = ['svg', 'ascii', 'json']

/**
 * qrcode-generator maps each code unit of the string through `c & 0xff`, so
 * feeding it a latin1 view of the UTF-8 bytes is what makes astral characters
 * (emoji, CJK, accents) encode correctly instead of being truncated.
 */
function toLatin1Utf8(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let out = ''
  for (const b of bytes) out += String.fromCharCode(b)
  return out
}

function intParam(value: unknown, label: string, min: number, max: number): number {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number`)
  const i = Math.trunc(n)
  if (i < min || i > max) throw new Error(`${label} must be between ${min} and ${max}`)
  return i
}

/** Colours land inside an SVG attribute, so refuse anything that could break out. */
function colorParam(value: unknown, label: string, fallback: string): string {
  const raw = value === undefined || value === null ? fallback : String(value).trim()
  if (raw === '') return ''
  if (/["'<>&]/.test(raw)) throw new Error(`${label} contains characters that are not valid in a colour`)
  return raw
}

const TRANSPARENT = new Set(['none', 'transparent'])

function buildQr(qrcode: QrFactory, text: string, level: Level): QrCode {
  const qr = qrcode(0, level)
  qr.addData(toLatin1Utf8(text), 'Byte')
  try {
    qr.make()
  } catch (e: any) {
    const message = String(e?.message ?? e)
    if (/overflow/i.test(message)) {
      throw new Error('input is too long for a QR code — shorten it or use a lower error-correction level')
    }
    throw new Error(`could not build a QR code: ${message}`)
  }
  return qr
}

function modulesOf(qr: QrCode): boolean[][] {
  const n = qr.getModuleCount()
  const rows: boolean[][] = []
  for (let r = 0; r < n; r++) {
    const row: boolean[] = []
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c))
    rows.push(row)
  }
  return rows
}

function toSvg(
  rows: boolean[][],
  moduleSize: number,
  margin: number,
  dark: string,
  light: string
): string {
  const n = rows.length
  const span = n + margin * 2
  const pixels = span * moduleSize

  let path = ''
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (rows[r][c]) path += `M${c + margin},${r + margin}h1v1h-1z`
    }
  }

  const background = light === '' || TRANSPARENT.has(light.toLowerCase())
    ? ''
    : `<rect width="${span}" height="${span}" fill="${light}"/>`
  const foreground = path === '' ? '' : `<path d="${path}" fill="${dark}"/>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixels}" height="${pixels}" ` +
    `viewBox="0 0 ${span} ${span}" shape-rendering="crispEdges" role="img" aria-label="QR code">` +
    `${background}${foreground}</svg>`
}

function toAscii(rows: boolean[][], moduleSize: number, margin: number): string {
  const n = rows.length
  // Terminal cells are about twice as tall as they are wide, so half the module
  // size gives roughly square output: the default moduleSize 4 ⇒ 2 chars wide.
  const cells = Math.max(1, Math.min(8, Math.round(moduleSize / 2)))
  const darkCell = '█'.repeat(cells)
  const lightCell = ' '.repeat(cells)
  const blank = lightCell.repeat(n + margin * 2)

  const lines: string[] = []
  for (let i = 0; i < margin; i++) lines.push(blank)
  for (let r = 0; r < n; r++) {
    let line = lightCell.repeat(margin)
    for (let c = 0; c < n; c++) line += rows[r][c] ? darkCell : lightCell
    line += lightCell.repeat(margin)
    lines.push(line)
  }
  for (let i = 0; i < margin; i++) lines.push(blank)
  return lines.join('\n')
}

const util: Utility = {
  id: 'qr_code',
  name: 'qr code',
  category: 'Generators',
  description:
    'Turn the input into a QR code as a self-contained inline SVG, ASCII art, or a JSON module matrix, with selectable error correction, module size, quiet-zone margin and colours.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['qr', 'barcode', '2d code', 'scan', 'qr generator'],
  aliases: ['qrencode'],
  examples: [
    {
      title: 'JSON module matrix for a short string',
      input: 'HI',
      params: { errorCorrection: 'L', output: 'json' },
      output: '{\n  "text": "HI",\n  "version": 1,\n  "errorCorrection": "L",\n  "moduleCount": 21,\n  "moduleSize": 4,\n  "margin": 4,\n  "dark": "#000000",\n  "light": "#ffffff",\n  "rows": [\n    "111111100100101111111",\n    "100000101001001000001",\n    "101110100100001011101",\n    "101110101001001011101",\n    "101110100011101011101",\n    "100000101110101000001",\n    "111111101010101111111",\n    "000000000011100000000",\n    "111110111100110101010",\n    "011101001110100100000",\n    "000001110001010011110",\n    "001100010010000110100",\n    "100001110001010010101",\n    "000000001011111001000",\n    "111111101000101100010",\n    "100000100101111001001",\n    "101110101010100100100",\n    "101110101110100100100",\n    "101110101001010011100",\n    "100000101000000110100",\n    "111111101111010011110"\n  ]\n}'
    }
  ],
  params: {
    errorCorrection: {
      kind: 'select',
      label: 'error correction',
      options: [...LEVELS],
      default: 'M'
    },
    moduleSize: { kind: 'number', label: 'module size (px)', default: 4, min: 1, max: 128 },
    margin: { kind: 'number', label: 'margin (modules)', default: 4, min: 0, max: 64 },
    dark: { kind: 'color', label: 'dark colour', default: '#000000' },
    light: { kind: 'color', label: 'light colour', default: '#ffffff' },
    output: { kind: 'select', label: 'output', options: OUTPUTS, default: 'svg' }
  },
  apply: async (input: any, params: any = {}): Promise<Value> => {
    const level = String(params.errorCorrection ?? 'M').toUpperCase() as Level
    if (!LEVELS.includes(level)) {
      throw new Error(`error correction must be one of ${LEVELS.join(', ')}`)
    }

    const output = String(params.output ?? 'svg')
    if (!OUTPUTS.includes(output)) throw new Error(`unknown output: ${output}`)

    const moduleSize = intParam(params.moduleSize ?? 4, 'module size', 1, 128)
    const margin = intParam(params.margin ?? 4, 'margin', 0, 64)
    const dark = colorParam(params.dark, 'dark colour', '#000000')
    const light = colorParam(params.light, 'light colour', '#ffffff')
    if (dark === '') throw new Error('dark colour must not be empty')

    const text = String(input ?? '')
    if (text === '') return output === 'json' ? {} : ''

    const qrcode = await getQrcode()
    const qr = buildQr(qrcode, text, level)
    const rows = modulesOf(qr)
    const moduleCount = rows.length

    if (output === 'ascii') return toAscii(rows, moduleSize, margin)
    if (output === 'json') {
      return {
        text,
        version: (moduleCount - 17) / 4,
        errorCorrection: level,
        moduleCount,
        moduleSize,
        margin,
        dark,
        light,
        rows: rows.map((row) => row.map((on) => (on ? '1' : '0')).join(''))
      }
    }
    return toSvg(rows, moduleSize, margin, dark, light)
  }
}

export default util
