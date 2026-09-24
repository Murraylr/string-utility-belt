import type { Utility } from '@/types/utility'

/**
 * Named character reference table — the mirror of `html_entity_encode`.
 *
 * Format: whitespace separated `name codePoint` pairs. Full HTML 4.01 set
 * (Latin-1, symbols/Greek/maths, special block) plus `apos`, the uppercase
 * legacy aliases, and a handful of widely supported HTML5 additions.
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
  // NB: HTML5 defines &lang;/&rang; (and the &langle;/&rangle; aliases) as
  // U+27E8/U+27E9, NOT the deprecated HTML4 CJK brackets U+2329/U+232A.
  'lceil 8968 rceil 8969 lfloor 8970 rfloor 8971 lang 10216 rang 10217 langle 10216 rangle 10217',
  'loz 9674 spades 9824 clubs 9827 hearts 9829 diams 9830',
  'starf 9733 star 9734 phone 9742 female 9792 male 9794',
  'sung 9834 flat 9837 natur 9838 sharp 9839 check 10003 cross 10007',
  // Uppercase aliases that legacy documents use (HTML5 keeps exactly these —
  // there is deliberately no `NBSP`, browsers leave `&NBSP;` as literal text).
  'QUOT 34 AMP 38 LT 60 GT 62 COPY 169 REG 174 TRADE 8482'
].join(' ')

/** entity name -> code point */
const NAME_TO_CP = new Map<string, number>()
const ENTITY_TOKENS = ENTITY_SOURCE.split(/\s+/).filter(Boolean)
for (let i = 0; i + 1 < ENTITY_TOKENS.length; i += 2) {
  const name = ENTITY_TOKENS[i]
  if (!NAME_TO_CP.has(name)) NAME_TO_CP.set(name, Number(ENTITY_TOKENS[i + 1]))
}

/**
 * The HTML5 "legacy" set: references that browsers still resolve when the
 * trailing semicolon is missing (`&nbsp` / `&copy` / `&amp`). It is exactly the
 * pre-HTML4 names, i.e. every name below U+0100 except `apos`.
 */
const LEGACY = new Set<string>()
for (const [name, cp] of NAME_TO_CP) if (cp < 256 && name !== 'apos') LEGACY.add(name)

/** Longest name in the table, used to bound the scan after an `&`. */
const MAX_NAME_LENGTH = Array.from(NAME_TO_CP.keys()).reduce((m, n) => Math.max(m, n.length), 0)

const isDecDigit = (c: string) => c >= '0' && c <= '9'
const isHexDigit = (c: string) => isDecDigit(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
const isAlnum = (c: string) => isDecDigit(c) || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')

/**
 * WHATWG "numeric character reference end state" table. Every HTML parser maps
 * numeric references in the C1 range to their windows-1252 counterparts, which
 * is how `&#146;` in real-world markup means U+2019 and not U+0092. Five slots
 * (0x81, 0x8D, 0x8F, 0x90, 0x9D) have no mapping and stay as they are.
 */
const C1_REMAP = new Map<number, number>([
  [0x80, 0x20ac], [0x82, 0x201a], [0x83, 0x0192], [0x84, 0x201e], [0x85, 0x2026],
  [0x86, 0x2020], [0x87, 0x2021], [0x88, 0x02c6], [0x89, 0x2030], [0x8a, 0x0160],
  [0x8b, 0x2039], [0x8c, 0x0152], [0x8e, 0x017d], [0x91, 0x2018], [0x92, 0x2019],
  [0x93, 0x201c], [0x94, 0x201d], [0x95, 0x2022], [0x96, 0x2013], [0x97, 0x2014],
  [0x98, 0x02dc], [0x99, 0x2122], [0x9a, 0x0161], [0x9b, 0x203a], [0x9c, 0x0153],
  [0x9e, 0x017e], [0x9f, 0x0178]
])

/** Applies to numeric references only — named references resolve straight from the table. */
const fromCodePoint = (cp: number, ref: string) => {
  if (!Number.isFinite(cp) || cp > 0x10ffff) throw new Error(`character reference out of range: ${ref}`)
  if (cp >= 0xd800 && cp <= 0xdfff) throw new Error(`character reference is a lone surrogate: ${ref}`)
  if (cp === 0) throw new Error(`null character reference: ${ref}`)
  return String.fromCodePoint(C1_REMAP.get(cp) ?? cp)
}

type Ref = { text: string; next: number }

/** Parse the reference starting at `s[at] === '&'`, or return null for a literal ampersand. */
const parseReference = (s: string, at: number): Ref | null => {
  if (s[at + 1] === '#') {
    let j = at + 2
    let radix = 10
    if (s[j] === 'x' || s[j] === 'X') {
      radix = 16
      j++
    }
    const start = j
    while (j < s.length && (radix === 16 ? isHexDigit(s[j]) : isDecDigit(s[j]))) j++
    if (j === start) return null
    const digits = s.slice(start, j)
    if (s[j] === ';') j++
    const ref = `&#${radix === 16 ? 'x' : ''}${digits};`
    return { text: fromCodePoint(parseInt(digits, radix), ref), next: j }
  }

  let j = at + 1
  while (j < s.length && j - at <= MAX_NAME_LENGTH && isAlnum(s[j])) j++
  const word = s.slice(at + 1, j)
  if (!word) return null

  // Fully terminated reference wins outright (`&notin;` -> U+2209).
  if (s[j] === ';' && NAME_TO_CP.has(word)) {
    return { text: String.fromCodePoint(NAME_TO_CP.get(word) as number), next: j + 1 }
  }
  // Otherwise fall back to the longest legacy name that prefixes the run,
  // matching how browsers read `&notit;` as `¬it;` and `&copyright` as `©right`.
  for (let len = word.length; len >= 2; len--) {
    const candidate = word.slice(0, len)
    if (LEGACY.has(candidate)) {
      return { text: String.fromCodePoint(NAME_TO_CP.get(candidate) as number), next: at + 1 + len }
    }
  }
  return null
}

const util: Utility = {
  id: 'html_entity_decode',
  name: 'html entity decode',
  category: 'Decoding',
  description:
    'Resolve HTML character references — named entities (with or without the trailing semicolon), &#decimal; and &#xHEX; — back to text.',
  accepts: 'string',
  produces: 'string',
  params: {},
  tags: ['html', 'entity', 'decode', 'unescape', 'named entity', 'numeric reference'],
  streamable: true,
  examples: [
    {
      title: 'named + numeric entities',
      input: '&lt;div&gt;Caf&eacute;&lt;/div&gt;',
      output: '<div>Café</div>'
    }
  ],
  apply: (input: any) => {
    const s = input === null || input === undefined ? '' : String(input)
    if (!s) return ''

    let out = ''
    let i = 0
    while (i < s.length) {
      const amp = s.indexOf('&', i)
      if (amp === -1) {
        out += s.slice(i)
        break
      }
      out += s.slice(i, amp)
      const ref = parseReference(s, amp)
      if (ref) {
        out += ref.text
        i = ref.next
      } else {
        // Not a reference we recognise — keep the ampersand verbatim.
        out += '&'
        i = amp + 1
      }
    }
    return out
  }
}

export default util
