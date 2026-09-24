import type { Utility } from '@/types/utility'

const asBool = (value: unknown, fallback: boolean): boolean => {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') return value !== 'false' && value !== '0'
  return Boolean(value)
}

function asText(input: unknown): string {
  if (input === undefined || input === null) return ''
  if (typeof input === 'string') return input
  if (input instanceof Uint8Array) return new TextDecoder().decode(input)
  if (typeof input === 'object') {
    throw new Error('strip html tags expects HTML text, but received structured data')
  }
  return String(input)
}

/* ------------------------------------------------------------------ *
 * Named character references
 * ------------------------------------------------------------------ */

const LATIN1_PUNCT =
  'nbsp,iexcl,cent,pound,curren,yen,brvbar,sect,uml,copy,ordf,laquo,not,shy,reg,macr,deg,plusmn,' +
  'sup2,sup3,acute,micro,para,middot,cedil,sup1,ordm,raquo,frac14,frac12,frac34,iquest'

const LATIN1_LETTERS =
  'Agrave,Aacute,Acirc,Atilde,Auml,Aring,AElig,Ccedil,Egrave,Eacute,Ecirc,Euml,Igrave,Iacute,Icirc,' +
  'Iuml,ETH,Ntilde,Ograve,Oacute,Ocirc,Otilde,Ouml,times,Oslash,Ugrave,Uacute,Ucirc,Uuml,Yacute,' +
  'THORN,szlig,agrave,aacute,acirc,atilde,auml,aring,aelig,ccedil,egrave,eacute,ecirc,euml,igrave,' +
  'iacute,icirc,iuml,eth,ntilde,ograve,oacute,ocirc,otilde,ouml,divide,oslash,ugrave,uacute,ucirc,' +
  'uuml,yacute,thorn,yuml'

const GREEK_UPPER =
  'Alpha,Beta,Gamma,Delta,Epsilon,Zeta,Eta,Theta,Iota,Kappa,Lambda,Mu,Nu,Xi,Omicron,Pi,Rho,Sigma,' +
  'Tau,Upsilon,Phi,Chi,Psi,Omega'

const GREEK_LOWER =
  'alpha,beta,gamma,delta,epsilon,zeta,eta,theta,iota,kappa,lambda,mu,nu,xi,omicron,pi,rho,sigmaf,' +
  'sigma,tau,upsilon,phi,chi,psi,omega'

/** Everything that is not a contiguous run: name -> code point. */
const EXTRA_ENTITIES: Record<string, number> = {
  OElig: 0x152, oelig: 0x153, Scaron: 0x160, scaron: 0x161, Yuml: 0x178, fnof: 0x192,
  circ: 0x2c6, tilde: 0x2dc, thetasym: 0x3d1, upsih: 0x3d2, piv: 0x3d6,
  ensp: 0x2002, emsp: 0x2003, thinsp: 0x2009, zwnj: 0x200c, zwj: 0x200d, lrm: 0x200e, rlm: 0x200f,
  ndash: 0x2013, mdash: 0x2014, lsquo: 0x2018, rsquo: 0x2019, sbquo: 0x201a, ldquo: 0x201c,
  rdquo: 0x201d, bdquo: 0x201e, dagger: 0x2020, Dagger: 0x2021, bull: 0x2022, hellip: 0x2026,
  permil: 0x2030, prime: 0x2032, Prime: 0x2033, lsaquo: 0x2039, rsaquo: 0x203a, oline: 0x203e,
  frasl: 0x2044, euro: 0x20ac, weierp: 0x2118, image: 0x2111, real: 0x211c, trade: 0x2122,
  alefsym: 0x2135, larr: 0x2190, uarr: 0x2191, rarr: 0x2192, darr: 0x2193, harr: 0x2194,
  crarr: 0x21b5, lArr: 0x21d0, uArr: 0x21d1, rArr: 0x21d2, dArr: 0x21d3, hArr: 0x21d4,
  forall: 0x2200, part: 0x2202, exist: 0x2203, empty: 0x2205, nabla: 0x2207, isin: 0x2208,
  notin: 0x2209, ni: 0x220b, prod: 0x220f, sum: 0x2211, minus: 0x2212, lowast: 0x2217,
  radic: 0x221a, prop: 0x221d, infin: 0x221e, ang: 0x2220, and: 0x2227, or: 0x2228, cap: 0x2229,
  cup: 0x222a, int: 0x222b, there4: 0x2234, sim: 0x223c, cong: 0x2245, asymp: 0x2248, ne: 0x2260,
  equiv: 0x2261, le: 0x2264, ge: 0x2265, sub: 0x2282, sup: 0x2283, nsub: 0x2284, sube: 0x2286,
  supe: 0x2287, oplus: 0x2295, otimes: 0x2297, perp: 0x22a5, sdot: 0x22c5, lceil: 0x2308,
  rceil: 0x2309, lfloor: 0x230a, rfloor: 0x230b, lang: 0x2329, rang: 0x232a, loz: 0x25ca,
  spades: 0x2660, clubs: 0x2663, hearts: 0x2665, diams: 0x2666
}

const ENTITIES: Record<string, string> = (() => {
  const map: Record<string, string> = { quot: '"', amp: '&', lt: '<', gt: '>', apos: "'" }
  LATIN1_PUNCT.split(',').forEach((name, i) => { map[name] = String.fromCharCode(0xa0 + i) })
  LATIN1_LETTERS.split(',').forEach((name, i) => { map[name] = String.fromCharCode(0xc0 + i) })
  // U+03A2 is unassigned, so the uppercase run skips it after Rho.
  GREEK_UPPER.split(',').forEach((name, i) => {
    map[name] = String.fromCharCode(0x391 + (i < 17 ? i : i + 1))
  })
  GREEK_LOWER.split(',').forEach((name, i) => { map[name] = String.fromCharCode(0x3b1 + i) })
  for (const [name, cp] of Object.entries(EXTRA_ENTITIES)) map[name] = String.fromCodePoint(cp)
  return map
})()

/**
 * Numeric references in 0x80–0x9F are windows-1252 code points, not C1 controls —
 * the HTML standard mandates this remap, and real-world markup relies on it
 * (`&#151;` means an em dash). Unmapped slots in the range stay as they are.
 */
const C1_REMAP: Record<number, number> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020,
  0x87: 0x2021, 0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152,
  0x8e: 0x017d, 0x91: 0x2018, 0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022,
  0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc, 0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a,
  0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178
}

const REPLACEMENT = '�'

function decodeEntities(text: string): string {
  return text.replace(
    /&(#[0-9]{1,8}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});/g,
    (whole, ref: string) => {
      if (ref[0] === '#') {
        const raw = ref[1] === 'x' || ref[1] === 'X'
          ? Number.parseInt(ref.slice(2), 16)
          : Number.parseInt(ref.slice(1), 10)
        if (!Number.isFinite(raw)) return whole
        // Null, lone surrogates and out-of-range values are not characters.
        if (raw === 0 || raw > 0x10ffff || (raw >= 0xd800 && raw <= 0xdfff)) return REPLACEMENT
        return String.fromCodePoint(C1_REMAP[raw] ?? raw)
      }
      return (Object.prototype.hasOwnProperty.call(ENTITIES, ref) ? ENTITIES[ref] : undefined) ?? whole
    }
  )
}

/* ------------------------------------------------------------------ *
 * Tag stripping
 * ------------------------------------------------------------------ */

/** Placeholder base for text held back from later passes. */
const NUL = String.fromCharCode(0)

const BLOCK_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'canvas', 'caption', 'colgroup', 'dd', 'details',
  'dialog', 'div', 'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'legend', 'li', 'main', 'menu', 'nav', 'noscript',
  'ol', 'option', 'output', 'p', 'pre', 'section', 'summary', 'table', 'tbody', 'tfoot', 'thead',
  'tr', 'ul', 'video'
])
const CELL_TAGS = new Set(['td', 'th'])
/** Block tags that start a new line but do not deserve a blank line after them. */
const LINE_TAGS = new Set(['li', 'tr', 'dt', 'dd', 'option', 'optgroup'])

/** `<tag ...>` / `</tag>`, tolerating `>` inside quoted attribute values. */
const TAG_RE = /<\/?([a-zA-Z][a-zA-Z0-9:-]*)(?:[^>"']|"[^"]*"|'[^']*')*>/g

function parseAllowedTags(raw: unknown): Set<string> {
  const value = raw === undefined || raw === null ? '' : String(raw)
  const allowed = new Set<string>()
  for (const part of value.split(/[\s,;|]+/)) {
    if (!part) continue
    if (!/^[a-zA-Z][a-zA-Z0-9:-]*$/.test(part)) {
      throw new Error(`invalid tag name in allowed tags: "${part}" — use bare names such as "b, i, a"`)
    }
    allowed.add(part.toLowerCase())
  }
  return allowed
}

function stripTags(
  html: string,
  allowed: Set<string>,
  preserveBreaks: boolean,
  keep: (tag: string) => string
): string {
  let s = html

  // Comments (including an unterminated one at the end of the input).
  s = s.replace(/<!--[\s\S]*?(?:-->|$)/g, '')

  // Script and style hold code, not readable text — drop their contents too.
  for (const tag of ['script', 'style']) {
    if (allowed.has(tag)) continue
    s = s.replace(
      new RegExp(`<${tag}\\b(?:[^>"']|"[^"]*"|'[^']*')*>[\\s\\S]*?(?:<\\/${tag}\\s*>|$)`, 'gi'),
      preserveBreaks ? '\n' : ' '
    )
  }

  // Processing instructions, CDATA sections, doctype declarations.
  s = s.replace(/<\?[\s\S]*?(?:\?>|$)/g, '')
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  s = s.replace(/<![^>]*>/g, '')

  s = s.replace(TAG_RE, (whole: string, name: string) => {
    const tag = name.toLowerCase()
    // Held aside so entity decoding and whitespace tidying cannot rewrite the
    // markup of a tag the caller asked to keep (`&amp;` inside an href must stay).
    if (allowed.has(tag)) return keep(whole)
    if (!preserveBreaks) return ' '
    if (tag === 'br' || tag === 'hr') return '\n'
    if (CELL_TAGS.has(tag)) return ' '
    // Siblings such as `</li><li>` should share a single break, while
    // `</p><p>` earns the blank line that two breaks produce.
    if (LINE_TAGS.has(tag)) return whole.startsWith('</') ? '' : '\n'
    if (BLOCK_TAGS.has(tag)) return '\n'
    return ''
  })

  return s
}

function tidy(text: string, preserveBreaks: boolean): string {
  if (!preserveBreaks) return text.replace(/[ \t\r\n\f\v]+/g, ' ').trim()
  return text
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const util: Utility = {
  id: 'strip_html_tags',
  name: 'strip html tags',
  category: 'String Ops',
  description:
    'Remove html tags to leave plain text, optionally decoding entities, keeping block level line breaks, and letting chosen tags through.',
  accepts: 'string',
  produces: 'string',
  tags: ['html to text', 'strip tags', 'remove html', 'html entities', 'plain text extraction', 'sanitize html'],
  examples: [
    { title: 'paragraphs to plain text', input: '<p>Hello <b>World</b></p><p>Bye</p>', output: 'Hello World\n\nBye' }
  ],
  params: {
    decodeEntities: { kind: 'boolean', label: 'decode entities', default: true },
    preserveBreaks: { kind: 'boolean', label: 'keep block line breaks', default: true },
    allowedTags: {
      kind: 'string',
      label: 'allowed tags',
      default: '',
      placeholder: 'b, i, a'
    }
  },
  apply: (input: any, params: any) => {
    const html = asText(input)
    const allowed = parseAllowedTags(params?.allowedTags)
    const preserveBreaks = asBool(params?.preserveBreaks, true)
    const shouldDecode = asBool(params?.decodeEntities, true)

    if (html === '') return ''

    // A non-whitespace sentinel that cannot collide with the input, so `tidy`
    // cannot swallow it the way it would swallow a space.
    let sentinel = NUL
    while (html.includes(sentinel)) sentinel += NUL
    const kept: string[] = []
    const keep = (tag: string) => {
      kept.push(tag)
      return `${sentinel}${kept.length - 1}${sentinel}`
    }

    let out = stripTags(html, allowed, preserveBreaks, keep)
    if (shouldDecode) out = decodeEntities(out)
    out = tidy(out, preserveBreaks)
    if (kept.length === 0) return out
    return out.replace(
      new RegExp(`${sentinel}(\\d+)${sentinel}`, 'g'),
      (_m, index: string) => kept[Number(index)] ?? ''
    )
  }
}

export default util
