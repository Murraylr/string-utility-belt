import type { Utility } from '@/types/utility'

/** The five predefined entities — the only names XML defines without a DTD. */
const PREDEFINED: Record<number, string> = {
  34: 'quot',
  38: 'amp',
  39: 'apos',
  60: 'lt',
  62: 'gt'
}

const SCOPES = ['minimal', 'non-ascii']

/**
 * XML 1.0 §2.2 Char production. Everything outside it — the C0 controls other
 * than tab/LF/CR, lone surrogates, U+FFFE and U+FFFF — cannot legally appear in
 * an XML document, not even as a numeric reference, so there is nothing valid
 * to emit for it.
 */
const isXmlChar = (cp: number) =>
  cp === 0x09 ||
  cp === 0x0a ||
  cp === 0x0d ||
  (cp >= 0x20 && cp <= 0xd7ff) ||
  (cp >= 0xe000 && cp <= 0xfffd) ||
  (cp >= 0x10000 && cp <= 0x10ffff)

const uPlus = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

const util: Utility = {
  id: 'xml_escape',
  name: 'xml escape',
  category: 'Encoding',
  description:
    'Escape text for XML using the five predefined entities (plus &#xD; for carriage returns), optionally leaving quotes alone or also escaping non-ASCII characters as numeric references.',
  accepts: 'string',
  produces: 'string',
  tags: ['xml', 'entity', 'escape', 'sanitize', 'encode', 'numeric character reference'],
  streamable: true,
  examples: [
    {
      title: 'markup and quotes',
      input: '<a href="x">Tom & Jerry\'s</a>',
      output: '&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&apos;s&lt;/a&gt;'
    },
    { title: 'non-ASCII as numeric references', input: 'café <tag>', params: { scope: 'non-ascii' }, output: 'caf&#xE9; &lt;tag&gt;' }
  ],
  params: {
    quotes: {
      kind: 'boolean',
      label: 'escape quotes (" and \')',
      default: true
    },
    scope: {
      kind: 'select',
      label: 'scope',
      options: ['minimal', 'non-ascii'],
      default: 'minimal'
    }
  },
  apply: (input: any, params: any) => {
    const scope = String(params?.scope ?? 'minimal')
    if (!SCOPES.includes(scope)) throw new Error(`unknown scope: ${scope} (expected minimal or non-ascii)`)
    const quotes = params?.quotes === undefined || params?.quotes === null ? true : Boolean(params.quotes)

    const s = input === null || input === undefined ? '' : String(input)
    if (!s) return ''

    let out = ''
    // for..of walks code points, so astral characters escape as one reference.
    for (const ch of s) {
      const cp = ch.codePointAt(0) ?? 0
      if (!isXmlChar(cp)) {
        throw new Error(`${uPlus(cp)} is not a legal XML 1.0 character and cannot be escaped`)
      }
      if (cp === 38 || cp === 60 || cp === 62 || (quotes && (cp === 34 || cp === 39))) {
        out += `&${PREDEFINED[cp]};`
      } else if (cp === 0x0d) {
        // XML 1.0 §2.11: parsers normalise literal CR (and CRLF) to a single LF
        // before the application ever sees it, so a bare carriage return is lost
        // on the next parse. A numeric reference is the only way to preserve it.
        out += '&#xD;'
      } else if (scope === 'non-ascii' && cp > 0x7f) {
        out += `&#x${cp.toString(16).toUpperCase()};`
      } else {
        out += ch
      }
    }
    return out
  }
}

export default util
