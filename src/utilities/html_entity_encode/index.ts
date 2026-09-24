import type { Utility } from '@/types/utility'

/**
 * Named character reference table.
 *
 * Format: whitespace separated `name codePoint` pairs. This is the full HTML 4.01
 * set (Latin-1, symbols/Greek/maths, and the "special" block) plus `apos` and a
 * handful of widely supported HTML5 additions — 270+ names in total.
 *
 * Order matters: the FIRST name listed for a code point is the one the encoder
 * emits (so U+2026 encodes as `&hellip;`, not the later alias `&mldr;`).
 */
const ENTITY_SOURCE = [
  // XML / HTML predefined
  'quot 34 amp 38 apos 39 lt 60 gt 62',
  // Latin-1 supplement
  'nbsp 160 iexcl 161 cent 162 pound 163 curren 164 yen 165 brvbar 166 sect 167',
  'uml 168 copy 169 ordf 170 laquo 171 not 172 shy 173 reg 174 macr 175',
  'deg 176 plusmn 177 sup2 178 sup3 179 acute 180 micro 181 para 182 middot 183',
  'cedil 184 sup1 185 ordm 186 raquo 187 frac14 188 frac12 189 frac34 190 iquest 191',
  'Agrave 192 Aacute 193 Acirc 194 Atilde 195 Auml 196 Aring 197 AElig 198 Ccedil 199',
  'Egrave 200 Eacute 201 Ecirc 202 Euml 203 Igrave 204 Iacute 205 Icirc 206 Iuml 207',
  'ETH 208 Ntilde 209 Ograve 210 Oacute 211 Ocirc 212 Otilde 213 Ouml 214 times 215',
  'Oslash 216 Ugrave 217 Uacute 218 Ucirc 219 Uuml 220 Yacute 221 THORN 222 szlig 223',
  'agrave 224 aacute 225 acirc 226 atilde 227 auml 228 aring 229 aelig 230 ccedil 231',
  'egrave 232 eacute 233 ecirc 234 euml 235 igrave 236 iacute 237 icirc 238 iuml 239',
  'eth 240 ntilde 241 ograve 242 oacute 243 ocirc 244 otilde 245 ouml 246 divide 247',
  'oslash 248 ugrave 249 uacute 250 ucirc 251 uuml 252 yacute 253 thorn 254 yuml 255',
  // Latin Extended-A/B and spacing modifier letters
  'OElig 338 oelig 339 Scaron 352 scaron 353 Yuml 376 fnof 402 circ 710 tilde 732',
  // Greek
  'Alpha 913 Beta 914 Gamma 915 Delta 916 Epsilon 917 Zeta 918 Eta 919 Theta 920',
  'Iota 921 Kappa 922 Lambda 923 Mu 924 Nu 925 Xi 926 Omicron 927 Pi 928',
  'Rho 929 Sigma 931 Tau 932 Upsilon 933 Phi 934 Chi 935 Psi 936 Omega 937',
  'alpha 945 beta 946 gamma 947 delta 948 epsilon 949 zeta 950 eta 951 theta 952',
  'iota 953 kappa 954 lambda 955 mu 956 nu 957 xi 958 omicron 959 pi 960',
  'rho 961 sigmaf 962 sigma 963 tau 964 upsilon 965 phi 966 chi 967 psi 968',
  'omega 969 thetasym 977 upsih 978 piv 982',
  // General punctuation
  'ensp 8194 emsp 8195 thinsp 8201 zwnj 8204 zwj 8205 lrm 8206 rlm 8207',
  'ndash 8211 mdash 8212 lsquo 8216 rsquo 8217 sbquo 8218 ldquo 8220 rdquo 8221 bdquo 8222',
  'dagger 8224 Dagger 8225 bull 8226 hellip 8230 permil 8240 prime 8242 Prime 8243',
  'lsaquo 8249 rsaquo 8250 oline 8254 frasl 8260 euro 8364',
  'nldr 8229 mldr 8230 hybull 8259 incare 8453 numero 8470 copysr 8471',
  // Letterlike symbols and arrows
  'weierp 8472 image 8465 real 8476 trade 8482 alefsym 8501',
  'larr 8592 uarr 8593 rarr 8594 darr 8595 harr 8596 crarr 8629',
  'lArr 8656 uArr 8657 rArr 8658 dArr 8659 hArr 8660',
  // Mathematical operators
  'forall 8704 part 8706 exist 8707 empty 8709 nabla 8711 isin 8712 notin 8713 ni 8715',
  'prod 8719 sum 8721 minus 8722 lowast 8727 radic 8730 prop 8733 infin 8734 ang 8736',
  'and 8743 or 8744 cap 8745 cup 8746 int 8747 there4 8756 sim 8764 cong 8773',
  'asymp 8776 ne 8800 equiv 8801 le 8804 ge 8805 sub 8834 sup 8835 nsub 8836',
  'sube 8838 supe 8839 oplus 8853 otimes 8855 perp 8869 sdot 8901',
  // Technical characters and geometric shapes
  // NB: HTML5 defines &lang;/&rang; as U+27E8/U+27E9 (the maths angle brackets),
  // NOT the deprecated HTML4 CJK brackets U+2329/U+232A — those get a numeric ref.
  'lceil 8968 rceil 8969 lfloor 8970 rfloor 8971 lang 10216 rang 10217',
  'loz 9674 spades 9824 clubs 9827 hearts 9829 diams 9830',
  'starf 9733 star 9734 phone 9742 female 9792 male 9794',
  'sung 9834 flat 9837 natur 9838 sharp 9839 check 10003 cross 10007'
].join(' ')

/** code point -> preferred entity name */
const CP_TO_NAME = new Map<number, string>()
const ENTITY_TOKENS = ENTITY_SOURCE.split(/\s+/).filter(Boolean)
for (let i = 0; i + 1 < ENTITY_TOKENS.length; i += 2) {
  const cp = Number(ENTITY_TOKENS[i + 1])
  if (!CP_TO_NAME.has(cp)) CP_TO_NAME.set(cp, ENTITY_TOKENS[i])
}

const MODES = ['named', 'decimal', 'hex']
const SCOPES = ['minimal', 'non-ascii', 'all']

/** The characters that are unsafe in HTML markup or in an attribute value. */
const MINIMAL = new Set([34, 38, 39, 60, 62])

const needsEncoding = (cp: number, scope: string) => {
  if (scope === 'all') return true
  if (MINIMAL.has(cp)) return true
  return scope === 'non-ascii' && cp > 0x7f
}

/**
 * HTML numeric character references cannot express U+0000 or the C1 controls
 * U+0080–U+009F: the HTML tokenizer rewrites `&#128;` to U+20AC (the historical
 * windows-1252 mapping) and `&#0;` to U+FFFD, so such a reference never reads
 * back as the character that produced it. A literal code unit is the only
 * faithful representation, so those are passed through even under `scope: all`.
 */
const isUnreferenceable = (cp: number) => cp === 0 || (cp >= 0x80 && cp <= 0x9f)

const reference = (cp: number, mode: string) => {
  if (mode === 'decimal') return `&#${cp};`
  if (mode === 'hex') return `&#x${cp.toString(16).toUpperCase()};`
  const name = CP_TO_NAME.get(cp)
  // Numeric fallback for anything without a name (astral code points included).
  return name ? `&${name};` : `&#${cp};`
}

const util: Utility = {
  id: 'html_entity_encode',
  name: 'html entity encode',
  category: 'Encoding',
  description:
    'Escape text as HTML character references using named, decimal, or hex form, over a minimal, non-ASCII, or all-characters scope.',
  accepts: 'string',
  produces: 'string',
  tags: ['html', 'entity', 'encode', 'named entity', 'ampersand', 'escape'],
  aliases: ['htmlentities'],
  params: {
    mode: {
      kind: 'select',
      label: 'reference form',
      options: ['named', 'decimal', 'hex'],
      default: 'named'
    },
    scope: {
      kind: 'select',
      label: 'scope',
      options: ['minimal', 'non-ascii', 'all'],
      default: 'non-ascii'
    }
  },
  examples: [
    { title: 'named, non-ascii scope', input: 'café < 5 & "ok"', output: 'caf&eacute; &lt; 5 &amp; &quot;ok&quot;' },
    { title: 'decimal, every character', input: 'café', params: { mode: 'decimal', scope: 'all' }, output: '&#99;&#97;&#102;&#233;' }
  ],
  apply: (input: any, params: any) => {
    const mode = String(params?.mode ?? 'named')
    const scope = String(params?.scope ?? 'non-ascii')
    if (!MODES.includes(mode)) throw new Error(`unknown mode: ${mode} (expected named, decimal or hex)`)
    if (!SCOPES.includes(scope)) throw new Error(`unknown scope: ${scope} (expected minimal, non-ascii or all)`)

    const s = input === null || input === undefined ? '' : String(input)
    if (!s) return ''

    let out = ''
    // for..of walks code points, so astral characters (emoji) stay whole.
    for (const ch of s) {
      const cp = ch.codePointAt(0) ?? 0
      out += needsEncoding(cp, scope) && !isUnreferenceable(cp) ? reference(cp, mode) : ch
    }
    return out
  }
}

export default util
