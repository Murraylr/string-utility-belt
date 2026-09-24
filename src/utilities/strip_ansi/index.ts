import type { Utility } from '@/types/utility'

/**
 * Remove ANSI terminal escape sequences from captured output.
 *
 * A hand-rolled scanner rather than one big regex, so it handles the whole
 * family correctly: CSI (colours, SGR, cursor movement), OSC (window titles and
 * OSC 8 hyperlinks) terminated by BEL or ST, DCS/SOS/PM/APC strings, plain
 * two-byte escapes such as `ESC ( B`, and the 8-bit C1 forms (0x9B, 0x9D, …).
 *
 * mode:
 *  - strip      drop every sequence together with its payload.
 *  - keep-text  drop the escape framing but keep the human-readable text an OSC
 *               sequence carries (window title, hyperlink URL).
 */

const ESC = 27
const BEL = 7
const ST = 0x9c

const isParamByte = (c: number) => c >= 0x30 && c <= 0x3f
const isIntermediateByte = (c: number) => c >= 0x20 && c <= 0x2f
const isFinalByte = (c: number) => c >= 0x40 && c <= 0x7e
const isEscFinalByte = (c: number) => c >= 0x30 && c <= 0x7e

const isControlByte = (c: number) => c < 0x20 || c === 0x7f || (c >= 0x80 && c <= 0x9f)

/**
 * keep-text must never re-emit an escape sequence a malformed OSC payload
 * smuggled in, so drop any nested CSI and every leftover control byte.
 */
const scrub = (text: string) => {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c === ESC || c === 0x9b) {
      let j = i + 1
      if (c === ESC && text[j] === '[') j++
      while (j < text.length && isParamByte(text.charCodeAt(j))) j++
      while (j < text.length && isIntermediateByte(text.charCodeAt(j))) j++
      if (j < text.length && isFinalByte(text.charCodeAt(j))) j++
      i = j - 1
      continue
    }
    // Surrogate halves are >= 0xD800, so astral characters survive intact.
    if (isControlByte(c)) continue
    out += text[i]
  }
  return out
}

/** Readable payload of an OSC sequence: everything but the numeric command. */
const oscText = (body: string) => {
  const parts = body.split(';')
  if (parts.length > 1 && /^[0-9]*$/.test(parts[0])) parts.shift()
  return scrub(parts.filter(part => part !== '').join(';'))
}

const util: Utility = {
  id: 'strip_ansi',
  name: 'strip ansi codes',
  category: 'String Ops',
  description:
    'Remove ANSI terminal escape sequences (SGR colours, CSI cursor moves, OSC titles and hyperlinks); keep-text mode preserves the readable text an OSC sequence carries.',
  accepts: 'string',
  produces: 'string',
  tags: ['ansi codes', 'terminal colors', 'escape sequences', 'strip colors', 'remove color codes', 'csi', 'osc'],
  examples: [
    { title: 'strip SGR color codes', input: '\u001b[31mred\u001b[0m text', params: { mode: 'strip' }, output: 'red text' }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['strip', 'keep-text'],
      default: 'strip'
    }
  },
  apply: (input: any, { mode = 'strip' }: any) => {
    const s = String(input ?? '')
    if (s === '') return ''
    const keepText = mode === 'keep-text'

    let out = ''
    let i = 0
    while (i < s.length) {
      const code = s.charCodeAt(i)
      let kind = ''
      let bodyStart = i + 1

      if (code === ESC) {
        const next = s[i + 1]
        if (next === undefined) throw new Error('unterminated ANSI escape sequence at end of input')
        if (next === '[') { kind = 'csi'; bodyStart = i + 2 }
        else if (next === ']') { kind = 'osc'; bodyStart = i + 2 }
        else if (next === 'P' || next === 'X' || next === '^' || next === '_') { kind = 'str'; bodyStart = i + 2 }
        else { kind = 'esc' }
      } else if (code === 0x9b) kind = 'csi'
      else if (code === 0x9d) kind = 'osc'
      else if (code === 0x90 || code === 0x98 || code === 0x9e || code === 0x9f) kind = 'str'

      // Ordinary text (including astral characters, copied through untouched).
      if (kind === '') { out += s[i]; i++; continue }

      if (kind === 'csi') {
        let j = bodyStart
        while (j < s.length && isParamByte(s.charCodeAt(j))) j++
        while (j < s.length && isIntermediateByte(s.charCodeAt(j))) j++
        if (j >= s.length || !isFinalByte(s.charCodeAt(j))) {
          throw new Error('unterminated CSI escape sequence')
        }
        i = j + 1
        continue
      }

      if (kind === 'osc' || kind === 'str') {
        let j = bodyStart
        let end = -1
        let terminatorLength = 0
        while (j < s.length) {
          const c = s.charCodeAt(j)
          if (c === BEL || c === ST) { end = j; terminatorLength = 1; break }
          if (c === ESC && s[j + 1] === '\\') { end = j; terminatorLength = 2; break }
          j++
        }
        if (end === -1) {
          throw new Error(kind === 'osc' ? 'unterminated OSC sequence' : 'unterminated device control string')
        }
        if (kind === 'osc' && keepText) out += oscText(s.slice(bodyStart, end))
        i = end + terminatorLength
        continue
      }

      // Plain escape: ESC, optional intermediates, one final byte.
      let j = bodyStart
      while (j < s.length && isIntermediateByte(s.charCodeAt(j))) j++
      if (j >= s.length || !isEscFinalByte(s.charCodeAt(j))) {
        throw new Error('malformed ANSI escape sequence')
      }
      i = j + 1
    }
    return out
  }
}

export default util
