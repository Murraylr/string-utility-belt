import type { Utility } from '@/types/utility'

/**
 * A hand-rolled 5x7 bitmap font (no figlet dependency). Every glyph is seven
 * rows of five cells; '#' is ink and '.' is empty. All four fonts are rendered
 * from this one bitmap:
 *
 *   block   full-block ink, two columns per pixel
 *   banner  '#' ink, one column per pixel
 *   small   half-block ink, two bitmap rows squeezed into one text row
 *   slant   like block, with each row sheared one column to the right
 */
export const GLYPHS: Record<string, string> = {
  ' ': '...../...../...../...../...../...../.....',
  A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
  B: '####./#...#/#...#/####./#...#/#...#/####.',
  C: '.###./#...#/#..../#..../#..../#...#/.###.',
  D: '####./#...#/#...#/#...#/#...#/#...#/####.',
  E: '#####/#..../#..../####./#..../#..../#####',
  F: '#####/#..../#..../####./#..../#..../#....',
  G: '.###./#...#/#..../#.###/#...#/#...#/.###.',
  H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
  I: '.###./..#../..#../..#../..#../..#../.###.',
  J: '..###/...#./...#./...#./...#./#..#./.##..',
  K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
  L: '#..../#..../#..../#..../#..../#..../#####',
  M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
  N: '#...#/##..#/#.#.#/#.#.#/#..##/#...#/#...#',
  O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
  P: '####./#...#/#...#/####./#..../#..../#....',
  Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
  R: '####./#...#/#...#/####./#.#../#..#./#...#',
  S: '.####/#..../#..../.###./....#/....#/####.',
  T: '#####/..#../..#../..#../..#../..#../..#..',
  U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
  V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
  W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
  X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
  Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
  Z: '#####/....#/...#./..#../.#.../#..../#####',
  '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
  '1': '..#../.##../..#../..#../..#../..#../.###.',
  '2': '.###./#...#/....#/...#./..#../.#.../#####',
  '3': '#####/...#./..#../...#./....#/#...#/.###.',
  '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
  '5': '#####/#..../####./....#/....#/#...#/.###.',
  '6': '..##./.#.../#..../####./#...#/#...#/.###.',
  '7': '#####/....#/...#./..#../.#.../.#.../.#...',
  '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
  '9': '.###./#...#/#...#/.####/....#/...#./.##..',
  '!': '..#../..#../..#../..#../..#../...../..#..',
  '"': '.#.#./.#.#./...../...../...../...../.....',
  '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
  $: '..#../.####/#.#../.###./..#.#/####./..#..',
  '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
  '&': '.##../#..#./#.#../.#.../#.#.#/#..#./.##.#',
  "'": '..#../..#../...../...../...../...../.....',
  '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
  ')': '.#.../..#../...#./...#./...#./..#../.#...',
  '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
  '+': '...../..#../..#../#####/..#../..#../.....',
  ',': '...../...../...../...../..#../..#../.#...',
  '-': '...../...../...../#####/...../...../.....',
  '.': '...../...../...../...../...../.##../.##..',
  '/': '....#/....#/...#./..#../.#.../#..../#....',
  ':': '...../.##../.##../...../.##../.##../.....',
  ';': '...../.##../.##../...../.##../..#../.#...',
  '<': '...#./..#../.#.../#..../.#.../..#../...#.',
  '=': '...../...../#####/...../#####/...../.....',
  '>': '.#.../..#../...#./....#/...#./..#../.#...',
  '?': '.###./#...#/....#/...#./..#../...../..#..',
  '@': '.###./#...#/#.###/#.#.#/#.###/#..../.###.',
  '[': '.###./.#.../.#.../.#.../.#.../.#.../.###.',
  '\\': '#..../#..../.#.../..#../...#./....#/....#',
  ']': '.###./...#./...#./...#./...#./...#./.###.',
  '^': '..#../.#.#./#...#/...../...../...../.....',
  _: '...../...../...../...../...../...../#####',
  '`': '..#../...#./...../...../...../...../.....',
  '{': '...##/..#../..#../.#.../..#../..#../...##',
  '|': '..#../..#../..#../..#../..#../..#../..#..',
  '}': '##.../..#../..#../...#./..#../..#../##...',
  '~': '...../...../.#..#/#.#.#/#..#./...../.....'
}

/** shown for anything the font has no glyph for */
const TOFU = '#####/#...#/#...#/#...#/#...#/#...#/#####'

const GLYPH_MAP = new Map(Object.entries(GLYPHS).map(([ch, rows]) => [ch, rows.split('/')]))
const TOFU_ROWS = TOFU.split('/')

export const FONTS = ['block', 'banner', 'small', 'slant']

const MAX_SPACING = 64

const FULL = '█'
const UPPER = '▀'
const LOWER = '▄'

type FontSpec = { ink: string; pixelWidth: number; half: boolean; slant: boolean }

const FONT_SPECS: Record<string, FontSpec> = {
  block: { ink: FULL, pixelWidth: 2, half: false, slant: false },
  banner: { ink: '#', pixelWidth: 1, half: false, slant: false },
  small: { ink: FULL, pixelWidth: 1, half: true, slant: false },
  slant: { ink: FULL, pixelWidth: 2, half: false, slant: true }
}

const BITMAP_ROWS = 7

const glyphRows = (ch: string): string[] => {
  const key = ch === '\t' ? ' ' : ch.toUpperCase()
  return GLYPH_MAP.get(key) ?? GLYPH_MAP.get(ch) ?? TOFU_ROWS
}

const solidRow = (row: string, spec: FontSpec) => {
  let out = ''
  for (const cell of row) out += (cell === '#' ? spec.ink : ' ').repeat(spec.pixelWidth)
  return out
}

const halfRow = (rows: string[], index: number) => {
  const top = rows[index * 2] ?? '.....'
  const bottom = rows[index * 2 + 1] ?? '.....'
  let out = ''
  for (let c = 0; c < top.length; c++) {
    const t = top[c] === '#'
    const b = bottom[c] === '#'
    out += t && b ? FULL : t ? UPPER : b ? LOWER : ' '
  }
  return out
}

const renderLine = (line: string, spec: FontSpec, spacing: number): string[] => {
  const glyphs = Array.from(line).map(glyphRows)
  const height = spec.half ? Math.ceil(BITMAP_ROWS / 2) : BITMAP_ROWS
  const gap = ' '.repeat(spacing)
  const out: string[] = []
  for (let r = 0; r < height; r++) {
    const parts = glyphs.map((rows) => (spec.half ? halfRow(rows, r) : solidRow(rows[r], spec)))
    const lead = spec.slant ? ' '.repeat(height - 1 - r) : ''
    // trimEnd, not /\s+$/: that regex is quadratic on a long blank run followed by ink
    out.push((lead + parts.join(gap)).trimEnd())
  }
  return out
}

const util: Utility = {
  id: 'ascii_banner',
  name: 'ascii banner',
  category: 'Formatting',
  description:
    'Render text as a large ASCII-art banner using a built-in block, banner, small, or slant font with adjustable letter spacing.',
  accepts: 'string',
  produces: 'string',
  tags: ['figlet', 'ascii art', 'banner', 'text art', 'big text', 'block letters'],
  aliases: ['figlet'],
  streamable: true,
  examples: [
    {
      title: 'banner font',
      input: 'HI',
      params: { font: 'banner', spacing: 1 },
      output: '#   #  ###\n#   #   #\n#   #   #\n#####   #\n#   #   #\n#   #   #\n#   #  ###'
    }
  ],
  params: {
    font: {
      kind: 'select',
      label: 'font',
      options: FONTS,
      default: 'block'
    },
    spacing: { kind: 'number', label: 'letter spacing', default: 1, min: 0, max: MAX_SPACING, integer: true }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const font = params?.font ?? 'block'
    if (!FONTS.includes(font)) {
      throw new Error(`unknown font: ${font} (expected ${FONTS.join(', ')})`)
    }
    const spacing = Number(params?.spacing ?? 1)
    if (!Number.isFinite(spacing)) throw new Error('spacing must be a number')
    if (spacing < 0) throw new Error('spacing must be 0 or greater')
    // the pipeline re-runs on every keystroke — a stray huge number must not
    // try to allocate a gigabyte of gap
    if (spacing > MAX_SPACING) throw new Error(`spacing must be ${MAX_SPACING} or less`)
    if (!s) return ''

    const spec = FONT_SPECS[font]
    return s
      .split(/\r\n|\r|\n/)
      .map((line) => (line === '' ? '' : renderLine(line, spec, Math.floor(spacing)).join('\n')))
      .join('\n')
  }
}

export default util
