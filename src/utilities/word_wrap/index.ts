import type { Utility } from '@/types/utility'

/** Width is measured in code points so astral characters count as one and never split. */
const cpLength = (s: string) => Array.from(s).length

/**
 * Whitespace that offers a break opportunity: everything `\s` matches EXCEPT the
 * non-breaking spaces. U+00A0, U+2007 (figure space), U+202F (narrow no-break space)
 * and U+FEFF are all `\s` in JavaScript, so splitting on `\s+` would both wrap where
 * the author forbade a break and silently rewrite those characters as plain spaces.
 */
const BREAKING_WS = /[^\S\u00a0\u2007\u202f\ufeff]+/gu

const splitWords = (s: string) => s.split(BREAKING_WS).filter(Boolean)

const numParam = (v: unknown, def: number, label: string) => {
  if (v === undefined || v === null || v === '') return def
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number`)
  return n
}

const boolParam = (v: unknown, def: boolean) => {
  if (v === undefined || v === null || v === '') return def
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

const strParam = (v: unknown, def: string) => (v === undefined || v === null ? def : String(v))

/**
 * A wrapped line plus whether the break that follows it fell between two words.
 * A break forced through the middle of an over-long word is not a word break, and
 * must never collect a trailing space — that space would become part of the word
 * as soon as anything (`unwrap`, a mail client) reflowed the text.
 */
export type WrapLine = { text: string; wordBreak: boolean }

/** Greedy first-fit wrapping of a word list into lines of at most `avail` code points. */
export const wrapWords = (words: string[], avail: number, breakLongWords: boolean): WrapLine[] => {
  const lines: WrapLine[] = []
  let cur = ''
  let curLen = 0
  const flush = (wordBreak: boolean) => {
    if (cur !== '') {
      lines.push({ text: cur, wordBreak })
      cur = ''
      curLen = 0
    }
  }
  for (const word of words) {
    let w = word
    let wLen = cpLength(w)
    if (breakLongWords && wLen > avail) {
      if (curLen > 0) {
        const room = avail - curLen - 1
        if (room > 0) {
          // fill the rest of the current line with the head of the word: the break
          // that follows lands inside the word, not between two words
          const cps = Array.from(w)
          cur += ' ' + cps.slice(0, room).join('')
          w = cps.slice(room).join('')
          wLen = cpLength(w)
          flush(false)
        } else {
          // no room for even one character — the whole word starts on the next line
          flush(true)
        }
      }
      const cps = Array.from(w)
      while (cps.length > avail) {
        lines.push({ text: cps.splice(0, avail).join(''), wordBreak: false })
      }
      cur = cps.join('')
      curLen = cps.length
      continue
    }
    if (curLen === 0) {
      cur = w
      curLen = wLen
    } else if (curLen + 1 + wLen <= avail) {
      cur += ' ' + w
      curLen += 1 + wLen
    } else {
      flush(true)
      cur = w
      curLen = wLen
    }
  }
  flush(true)
  return lines
}

const util: Utility = {
  id: 'word_wrap',
  name: 'word wrap',
  category: 'Formatting',
  description:
    'Wrap text to a fixed column width, optionally breaking long words, prefixing each line with an indent, reflowing whole paragraphs and keeping the soft-break trailing space.',
  accepts: 'string',
  produces: 'string',
  tags: ['wrap', 'column width', 'reflow', 'line length', 'fill', 'fold', 'text wrap'],
  aliases: ['fold', 'fmt'],
  examples: [
    {
      title: 'wrap to 20 columns',
      input: 'The quick brown fox jumps over the lazy dog',
      params: { width: 20 },
      output: 'The quick brown fox\njumps over the lazy\ndog'
    }
  ],
  params: {
    width: { kind: 'number', label: 'width', default: 80, min: 1, integer: true },
    breakLongWords: { kind: 'boolean', label: 'break long words', default: false },
    indent: { kind: 'string', label: 'line indent', default: '' },
    preserveParagraphs: { kind: 'boolean', label: 'reflow wrapped lines', default: true },
    trailingSpaces: { kind: 'boolean', label: 'keep trailing space', default: false }
  },
  apply: (input: any, params: any) => {
    const p = params || {}
    const s = input === undefined || input === null ? '' : String(input)
    const width = numParam(p.width, 80, 'width')
    const breakLongWords = boolParam(p.breakLongWords, false)
    const indent = strParam(p.indent, '')
    const preserveParagraphs = boolParam(p.preserveParagraphs, true)
    const trailingSpaces = boolParam(p.trailingSpaces, false)

    if (!Number.isInteger(width) || width < 1) {
      throw new Error('width must be a whole number >= 1')
    }
    if (/[\r\n]/.test(indent)) throw new Error('indent must not contain a line break')
    const avail = width - cpLength(indent)
    if (avail < 1) {
      throw new Error(`indent (${cpLength(indent)}) leaves no room inside width (${width})`)
    }
    if (s === '') return ''

    const decorate = (lines: WrapLine[]) =>
      lines.map(
        (line, i) =>
          indent +
          line.text +
          (trailingSpaces && line.wordBreak && i < lines.length - 1 ? ' ' : '')
      )

    const wrapBlock = (blockLines: string[]): string[] => {
      if (preserveParagraphs) {
        return decorate(wrapWords(splitWords(blockLines.join(' ')), avail, breakLongWords))
      }
      const res: string[] = []
      for (const line of blockLines) {
        res.push(...decorate(wrapWords(splitWords(line), avail, breakLongWords)))
      }
      return res
    }

    const out: string[] = []
    let block: string[] = []
    const flush = () => {
      if (block.length) {
        out.push(...wrapBlock(block))
        block = []
      }
    }
    for (const line of s.split(/\r\n|\n|\r/)) {
      if (line.trim() === '') {
        flush()
        out.push('')
      } else {
        block.push(line)
      }
    }
    flush()
    return out.join('\n')
  }
}

export default util
