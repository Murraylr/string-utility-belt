import type { Utility } from '@/types/utility'

const MAX_CODE_POINT = 0x10ffff

/**
 * Every escape syntax produced by `unicode_escape_encode`, plus a few common
 * neighbours (`\xNN`, `\U00000000`). Order matters: longer / more specific
 * forms come first so `\u{1f600}` is not mistaken for `\u` + text.
 *
 * 1. `\u{1F600}`  ES2015 brace escape
 * 2. `\uD83D`     JS / Java UTF-16 escape
 * 3. `\U0001F600` Python wide escape
 * 4. `\xE9`       byte escape
 * 5. `\1F600 `    CSS escape (2-6 digits, optional single-space delimiter)
 * 6. `\9 `        CSS escape, single digit — requires the delimiter so that
 *                 regex-ish text such as `\d` or `\b` is left alone
 * 7. `&#x1F600;`  HTML hex entity
 * 8. `&#128512;`  HTML decimal entity
 */
const ESCAPE_RE =
  /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})|\\U([0-9a-fA-F]{8})|\\x([0-9a-fA-F]{2})|\\([0-9a-fA-F]{2,6})[ \t]?|\\([0-9a-fA-F])[ \t]|&#[xX]([0-9a-fA-F]{1,6});|&#([0-9]{1,7});/g

function toChar(cp: number, raw: string): string {
  if (!Number.isFinite(cp) || cp < 0 || cp > MAX_CODE_POINT) {
    throw new Error(`code point out of range in "${raw}" (maximum is U+10FFFF)`)
  }
  // Lone surrogates are preserved as-is; adjacent halves concatenate back into
  // the astral character they came from.
  return String.fromCodePoint(cp)
}

const util: Utility = {
  id: 'unicode_escape_decode',
  name: 'unicode unescape',
  category: 'Decoding',
  description:
    'Decode \\uXXXX, \\u{...}, \\xNN, \\U00000000, CSS and HTML entity escapes in one pass, leaving any other text untouched.',
  accepts: 'string',
  produces: 'string',
  tags: ['unicode', 'escape', 'decode', 'codepoint', 'unescape', 'u+'],
  streamable: true,
  params: {},
  examples: [
    { title: 'JS/Java \\u escapes', input: '\\u0041\\u0042\\u0043', output: 'ABC' },
    { title: 'ES2015 brace escape', input: '\\u{1F600}', output: '😀' },
    { title: 'HTML entities', input: '&#x1F600; &#128512;', output: '😀 😀' }
  ],
  apply: (input: any) => {
    const s = input === null || input === undefined ? '' : String(input)
    if (!s) return ''

    return s.replace(
      ESCAPE_RE,
      (
        raw: string,
        braces: string | undefined,
        u16: string | undefined,
        wide: string | undefined,
        byte: string | undefined,
        cssMulti: string | undefined,
        cssSingle: string | undefined,
        htmlHex: string | undefined,
        htmlDec: string | undefined
      ) => {
        const asHex = braces ?? u16 ?? wide ?? byte ?? cssMulti ?? cssSingle ?? htmlHex
        if (asHex !== undefined) return toChar(parseInt(asHex, 16), raw)
        if (htmlDec !== undefined) return toChar(parseInt(htmlDec, 10), raw)
        return raw
      }
    )
  }
}

export default util
