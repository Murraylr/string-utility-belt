import { asText, valueType } from '@/core/coerce'
import type { Value } from '@/types/utility'

export interface ValueStats {
  type: 'string' | 'bytes' | 'json'
  /** Unicode code points (surrogate pairs count as one). Absent for bytes. */
  codePoints?: number
  words?: number
  lines?: number
  /** UTF-8 byte length of the text form; for bytes this is just the raw length. */
  utf8Bytes: number
}

/** Exactly the code units JavaScript's `\s` matches, so word counts agree with `split(/\s+/)`. */
function isSpace(c: number): boolean {
  return (c >= 0x09 && c <= 0x0d) || c === 0x20 || c === 0xa0 || c === 0x1680 ||
    (c >= 0x2000 && c <= 0x200a) || c === 0x2028 || c === 0x2029 || c === 0x202f ||
    c === 0x205f || c === 0x3000 || c === 0xfeff
}

/**
 * One allocation-free pass over the text: the input panel recomputes this on every keystroke,
 * so `Array.from` / `TextEncoder` / `split` copies of a megabyte input are too slow here.
 */
function textStats(text: string): { codePoints: number; words: number; lines: number; utf8Bytes: number } {
  let codePoints = 0, words = 0, newlines = 0, utf8Bytes = 0
  let inWord = false
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i)
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const d = text.charCodeAt(i + 1)
      if (d >= 0xdc00 && d <= 0xdfff) {
        codePoints++; utf8Bytes += 4; i++
        if (!inWord) { words++; inWord = true }
        continue
      }
    }
    codePoints++
    // a lone surrogate is encoded as U+FFFD (3 bytes), like TextEncoder does
    utf8Bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : 3
    if (c === 0x0a) newlines++
    if (isSpace(c)) inWord = false
    else if (!inWord) { words++; inWord = true }
  }
  return { codePoints, words, lines: text === '' ? 0 : newlines + 1, utf8Bytes }
}

export function computeStats(value: Value): ValueStats {
  const type = valueType(value)
  if (type === 'bytes') {
    const len = (value as Uint8Array).length
    return { type, utf8Bytes: len }
  }
  return { type, ...textStats(asText(value)) }
}
