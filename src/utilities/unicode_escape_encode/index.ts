import type { Utility } from '@/types/utility'

type Style = 'js-u' | 'js-braces' | 'css' | 'python' | 'java' | 'html-hex' | 'html-dec'
type Scope = 'non-ascii' | 'all'

const STYLES: Style[] = ['js-u', 'js-braces', 'css', 'python', 'java', 'html-hex', 'html-dec']
const SCOPES: Scope[] = ['non-ascii', 'all']

/** Lower-case hex, optionally zero-padded to a fixed width. */
const hex = (n: number, pad = 0) => n.toString(16).padStart(pad, '0')

/**
 * The two characters that introduce an escape in any of the supported
 * syntaxes: `\` (js / java / python / css) and `&` (HTML entities). Both are
 * escaped even in `non-ascii` scope, because `unicode_escape_decode` resolves
 * every style in one pass — leaving a literal `\e9 ` or `&#233;` in the output
 * would make it decode to `é` and the encoding would not be reversible.
 * Escaping `\` also matters on its own merit: a raw `C:\temp` pasted into a JS
 * or Java literal silently becomes `C:<TAB>emp`.
 */
const ALWAYS_ESCAPE = new Set([0x5c, 0x26])

/** Split an astral code point into its UTF-16 surrogate pair. */
export function surrogatePair(cp: number): [number, number] {
  const v = cp - 0x10000
  return [0xd800 + (v >> 10), 0xdc00 + (v & 0x3ff)]
}

/** Render one code point in the requested escape syntax. */
export function escapeCodePoint(cp: number, style: Style): string {
  switch (style) {
    // Both JavaScript's classic `\uXXXX` and Java's escape operate on UTF-16
    // code units, so astral characters become a surrogate pair.
    case 'js-u':
    case 'java': {
      if (cp > 0xffff) {
        const [hi, lo] = surrogatePair(cp)
        return `\\u${hex(hi, 4)}\\u${hex(lo, 4)}`
      }
      return `\\u${hex(cp, 4)}`
    }
    case 'js-braces':
      return `\\u{${hex(cp)}}`
    // CSS escapes are `\` + up to six hex digits. The trailing space is the
    // standard delimiter and keeps the escape unambiguous when the next
    // character happens to be a hex digit or a space.
    case 'css':
      return `\\${hex(cp)} `
    case 'python':
      return cp > 0xffff ? `\\U${hex(cp, 8)}` : `\\u${hex(cp, 4)}`
    case 'html-hex':
      return `&#x${hex(cp)};`
    case 'html-dec':
      return `&#${cp};`
    default:
      throw new Error(`unknown style: ${String(style)}`)
  }
}

const util: Utility = {
  id: 'unicode_escape_encode',
  name: 'unicode escape',
  category: 'Encoding',
  description:
    'Escape characters as \\uXXXX, \\u{...}, CSS, Python, Java or HTML entities, either for non-ASCII only or for every character; the escape delimiters \\ and & are always escaped so the result decodes back exactly.',
  accepts: 'string',
  produces: 'string',
  tags: ['unicode', 'escape', 'backslash u', 'utf-16', 'html entity', 'css escape', 'python escape'],
  examples: [
    { title: 'non-ASCII, default style', input: 'café 日本語', output: 'caf\\u00e9 \\u65e5\\u672c\\u8a9e' },
    { title: 'every character, CSS style', input: 'Hi!', params: { style: 'css', scope: 'all' }, output: '\\48 \\69 \\21 ' }
  ],
  params: {
    style: {
      kind: 'select',
      label: 'style',
      options: [...STYLES],
      default: 'js-u'
    },
    scope: {
      kind: 'select',
      label: 'scope',
      options: [...SCOPES],
      default: 'non-ascii'
    }
  },
  apply: (input: any, params: any) => {
    const s = input === null || input === undefined ? '' : String(input)
    const style = (params?.style ?? 'js-u') as Style
    const scope = (params?.scope ?? 'non-ascii') as Scope
    if (!STYLES.includes(style)) throw new Error(`unknown style: ${String(style)}`)
    if (!SCOPES.includes(scope)) throw new Error(`unknown scope: ${String(scope)}`)
    if (!s) return ''

    let out = ''
    // Iterate code points so astral characters are escaped as one unit.
    for (const ch of s) {
      const cp = ch.codePointAt(0) as number
      if (scope === 'non-ascii' && cp <= 0x7f && !ALWAYS_ESCAPE.has(cp)) {
        out += ch
        continue
      }
      out += escapeCodePoint(cp, style)
    }
    return out
  }
}

export default util
