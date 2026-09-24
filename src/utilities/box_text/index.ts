import type { Utility } from '@/types/utility'

type BoxChars = { tl: string; tr: string; bl: string; br: string; h: string; v: string }

export const BOX_STYLES: Record<string, BoxChars> = {
  single: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '─', v: '│' },
  double: { tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
  round: { tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '│' },
  bold: { tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
  ascii: { tl: '+', tr: '+', bl: '+', br: '+', h: '-', v: '|' },
  dashed: { tl: '┌', tr: '┐', bl: '└', br: '┘', h: '╌', v: '╎' }
}

export const STYLE_NAMES = Object.keys(BOX_STYLES)
const ALIGNMENTS = ['left', 'center', 'right']

/** the pipeline re-runs on every keystroke, so a stray huge number must not
 *  try to allocate a gigabyte of border */
const MAX_WIDTH = 10000
const MAX_PADDING = 500

const ZERO_WIDTH: Array<[number, number]> = [
  [0x0300, 0x036f], [0x0483, 0x0489], [0x0591, 0x05bd], [0x0610, 0x061a],
  [0x064b, 0x065f], [0x0670, 0x0670], [0x06d6, 0x06dc], [0x0e31, 0x0e31],
  [0x0e34, 0x0e3a], [0x0e47, 0x0e4e], [0x1ab0, 0x1aff], [0x1dc0, 0x1dff],
  [0x200b, 0x200f], [0x202a, 0x202e], [0x2060, 0x2064], [0x2066, 0x2069],
  [0x20d0, 0x20f0],
  // the kana voiced-sound marks sit inside the wide block below but are
  // combining marks, so they must be classified zero-width first
  [0x3099, 0x309a],
  [0xfe00, 0xfe0f], [0xfe20, 0xfe2f], [0xfeff, 0xfeff],
  [0xe0100, 0xe01ef]
]

const WIDE: Array<[number, number]> = [
  [0x1100, 0x115f], [0x2e80, 0x303e], [0x3041, 0x33ff], [0x3400, 0x4dbf],
  [0x4e00, 0x9fff], [0xa000, 0xa4cf], [0xa960, 0xa97f], [0xac00, 0xd7a3],
  [0xf900, 0xfaff], [0xfe10, 0xfe19], [0xfe30, 0xfe6f], [0xff00, 0xff60],
  [0xffe0, 0xffe6], [0x1f300, 0x1f64f], [0x1f680, 0x1f6ff], [0x1f900, 0x1f9ff],
  [0x20000, 0x3fffd]
]

const inRanges = (cp: number, ranges: Array<[number, number]>) =>
  ranges.some(([lo, hi]) => cp >= lo && cp <= hi)

/** terminal columns a single code point occupies */
const charWidth = (ch: string) => {
  const cp = ch.codePointAt(0) as number
  if (inRanges(cp, ZERO_WIDTH)) return 0
  if (inRanges(cp, WIDE)) return 2
  return 1
}

export const displayWidth = (s: string) => {
  let w = 0
  for (const ch of s) w += charWidth(ch)
  return w
}

const TAB_WIDTH = 8

/**
 * A tab is one code point but many columns, so it has to become real spaces
 * before anything measures the line — otherwise the right border of the box
 * lands in a different place than the terminal draws it.
 */
export const expandTabs = (line: string) => {
  if (!line.includes('\t')) return line
  let out = ''
  let col = 0
  for (const ch of line) {
    if (ch === '\t') {
      const step = TAB_WIDTH - (col % TAB_WIDTH)
      out += ' '.repeat(step)
      col += step
    } else {
      out += ch
      col += charWidth(ch)
    }
  }
  return out
}

/** break a single over-long token into chunks of at most `width` columns */
const hardBreak = (word: string, width: number): string[] => {
  const chunks: string[] = []
  let current = ''
  let used = 0
  for (const ch of word) {
    const w = charWidth(ch)
    if (used + w > width && current) {
      chunks.push(current)
      current = ''
      used = 0
    }
    current += ch
    used += w
  }
  if (current) chunks.push(current)
  return chunks
}

/**
 * Greedy word wrap. Runs of spaces are their own tokens and stay pending until
 * a word is committed after them, so leading indentation and interior double
 * spaces survive, spaces that land on a break are dropped instead of dangling
 * at the end of a row, and a trailing space cannot conjure an empty row.
 */
const wrapLine = (line: string, width: number): string[] => {
  if (displayWidth(line) <= width) return [line]
  const out: string[] = []
  let current = ''
  let pending = ''
  const breakWord = (word: string) => {
    const parts = hardBreak(word, width)
    current = parts.pop() as string
    out.push(...parts)
  }
  for (const token of line.match(/ +|[^ ]+/g) ?? []) {
    if (token[0] === ' ') {
      pending += token
      continue
    }
    const joined = current + pending
    if (displayWidth(joined) + displayWidth(token) <= width) {
      current = joined + token
      pending = ''
      continue
    }
    if (current !== '') out.push(current)
    current = ''
    pending = ''
    if (displayWidth(token) <= width) current = token
    else breakWord(token)
  }
  if (current !== '') out.push(current)
  return out.length > 0 ? out : ['']
}

const align = (text: string, width: number, mode: string) => {
  const slack = Math.max(0, width - displayWidth(text))
  if (mode === 'right') return ' '.repeat(slack) + text
  if (mode === 'center') {
    const left = Math.floor(slack / 2)
    return ' '.repeat(left) + text + ' '.repeat(slack - left)
  }
  return text + ' '.repeat(slack)
}

/** cut a title down to at most `width` columns, code point by code point */
const clip = (text: string, width: number) => {
  let out = ''
  let used = 0
  for (const ch of text) {
    const w = charWidth(ch)
    if (used + w > width) break
    out += ch
    used += w
  }
  return out
}

const util: Utility = {
  id: 'box_text',
  name: 'box text',
  category: 'Formatting',
  description:
    'Draw a border around text with single, double, round, bold, ascii, or dashed box characters, plus padding, alignment, an optional title, and a fixed width.',
  accepts: 'string',
  produces: 'string',
  tags: ['border', 'frame', 'ascii box', 'box drawing', 'text box', 'card'],
  examples: [
    { title: 'single-line border', input: 'Hi', output: '┌────┐\n│ Hi │\n└────┘' },
    {
      title: 'double border with a title',
      input: 'Hello',
      params: { style: 'double', title: 'Note' },
      output: '╔═ Note ═╗\n║ Hello  ║\n╚════════╝'
    }
  ],
  params: {
    style: {
      kind: 'select',
      label: 'style',
      options: STYLE_NAMES,
      default: 'single'
    },
    padding: { kind: 'number', label: 'padding', default: 1, min: 0, max: MAX_PADDING, integer: true },
    align: {
      kind: 'select',
      label: 'align',
      options: ALIGNMENTS,
      default: 'left'
    },
    title: { kind: 'string', label: 'title', default: '' },
    width: { kind: 'number', label: 'width (0 = fit content)', default: 0, min: 0, max: MAX_WIDTH, integer: true }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    const styleName = params?.style ?? 'single'
    if (!Object.prototype.hasOwnProperty.call(BOX_STYLES, styleName)) {
      throw new Error(`unknown box style: ${styleName} (expected ${STYLE_NAMES.join(', ')})`)
    }
    const alignMode = params?.align ?? 'left'
    if (!ALIGNMENTS.includes(alignMode)) {
      throw new Error(`unknown alignment: ${alignMode} (expected ${ALIGNMENTS.join(', ')})`)
    }
    const padding = Number(params?.padding ?? 1)
    if (!Number.isFinite(padding)) throw new Error('padding must be a number')
    if (padding < 0) throw new Error('padding must be 0 or greater')
    if (padding > MAX_PADDING) throw new Error(`padding must be ${MAX_PADDING} or less`)
    const totalWidth = Number(params?.width ?? 0)
    if (!Number.isFinite(totalWidth)) throw new Error('width must be a number')
    if (totalWidth < 0) throw new Error('width must be 0 or greater')
    if (totalWidth > MAX_WIDTH) throw new Error(`width must be ${MAX_WIDTH} or less`)
    if (!s) return ''

    const chars = BOX_STYLES[styleName]
    // a line break inside the title would tear the border apart
    const title = expandTabs(String(params?.title ?? '').replace(/[\r\n]+/g, ' '))
    // one padding unit is a space column; vertical padding only kicks in past 1
    // so the default (1) gives the classic single-line-tall box
    const hpad = Math.floor(padding)
    const vpad = Math.max(0, Math.floor(padding) - 1)

    let lines = s.split(/\r\n|\r|\n/).map(expandTabs)
    let contentWidth: number

    if (totalWidth > 0) {
      contentWidth = Math.floor(totalWidth) - 2 - hpad * 2
      if (contentWidth < 1) {
        throw new Error(
          `width ${Math.floor(totalWidth)} is too small for the border and padding ${hpad}`
        )
      }
      lines = lines.flatMap((line) => wrapLine(line, contentWidth))
    } else {
      contentWidth = lines.reduce((max, line) => Math.max(max, displayWidth(line)), 0)
      const titleNeeds = title ? displayWidth(title) + 4 - hpad * 2 : 0
      contentWidth = Math.max(contentWidth, titleNeeds, 1)
    }

    const innerWidth = contentWidth + hpad * 2
    const pad = ' '.repeat(hpad)

    const titleRoom = innerWidth - 4
    // `shown` can still come back empty when the first title character is wider
    // than the room left for it — then there is no title to draw at all
    const shown = title && titleRoom >= 1 ? clip(title, titleRoom) : ''
    const top = shown
      ? chars.tl + chars.h + ' ' + shown + ' ' +
        chars.h.repeat(innerWidth - displayWidth(shown) - 3) + chars.tr
      : chars.tl + chars.h.repeat(innerWidth) + chars.tr

    const blank = chars.v + ' '.repeat(innerWidth) + chars.v
    const body = lines.map((line) => chars.v + pad + align(line, contentWidth, alignMode) + pad + chars.v)
    const bottom = chars.bl + chars.h.repeat(innerWidth) + chars.br

    return [
      top,
      ...Array.from({ length: vpad }, () => blank),
      ...body,
      ...Array.from({ length: vpad }, () => blank),
      bottom
    ].join('\n')
  }
}

export default util
