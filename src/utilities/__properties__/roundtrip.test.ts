/**
 * Round-trip property tests: for every inverse pair in the roadmap (§13.1),
 * `decode(encode(x))` deep-equals `x` across ~100 generated inputs (fewer for
 * slow ones: AES, and anything that shells out to a dynamically-imported
 * parser library).
 *
 * Each side runs as a real pipeline step (defaults resolved, input coerced),
 * and the shared `text` arbitrary deliberately includes control characters,
 * escape syntax and arbitrary code points, not just printable graphemes.
 *
 * Where a pair does not accept arbitrary Unicode input unchanged, the
 * arbitrary is deliberately narrowed and the comment next to it explains
 * whether that is an inherent property of the format (e.g. TOML has no null,
 * Morse has a fixed alphabet, windows-1252 is a 256-code-point charset, a
 * leading BOM is a byte-order signature), a simplification made to keep the
 * property meaningful (e.g. CSV records all sharing one column set), or a
 * known app-level ambiguity reported rather than papered over (msgpack's
 * bare-string root). A failure here is a bug in the utility: shrink it, fix
 * it there with a regression test in that utility's `index.test.ts`.
 */
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { runPipeline } from '../index'
import type { Params, Value } from '../../types/utility'

/**
 * Runs one utility as a single-step pipeline through the real runner, so the
 * property sees exactly what the app does: declared param defaults filled in
 * (`resolveParams`) and the input coerced to what the utility accepts
 * (`coerceInputFor`, e.g. bytes -> text for a string-only decoder). Calling
 * `apply` directly would skip both and test a path no pipeline can take.
 */
const apply = async (id: string, input: unknown, params: Params = {}): Promise<unknown> => {
  const res = await runPipeline(input as Value, [{ id: 'step', utilityId: id, params }])
  if (res.err.step) throw new Error(`${id} failed: ${res.err.step}`)
  return res.out
}

/** Registers `decode(encode(x)) === x` as a vitest test. */
function roundtrip<T>(
  name: string,
  arbitrary: fc.Arbitrary<T>,
  encode: (x: T) => unknown | Promise<unknown>,
  decode: (encoded: unknown) => unknown | Promise<unknown>,
  numRuns = 100
) {
  it(name, async () => {
    await fc.assert(
      fc.asyncProperty(arbitrary, async (x) => {
        const encoded = await encode(x)
        const decoded = await decode(encoded)
        expect(decoded).toEqual(x)
      }),
      { numRuns }
    )
  })
}

// --- shared arbitraries ------------------------------------------------

/**
 * Characters fast-check's printable `grapheme` unit never produces (it skips
 * every C0/C1 control, so no `\n`, `\r`, `\t` or NUL) plus the syntax
 * characters escapers most often get wrong. Without these, every escape pair
 * below would pass without ever seeing a newline.
 */
const SPECIAL_CHARS = [
  '\n', '\r', '\r\n', '\t', '\0', '\x07', '\b', '\f', '\v', '\x1b', '\x7f', '\x85', '\x9f',
  '\u2028', '\u2029', '\ufeff', '\u00a0', '\u200d', '\u0301',
  '\\', '"', "'", '`', '$', '{', '}', '[', ']', '&', ';', '#', '=', '%', '+', ' ', '<', '>', '?', '/', ':', ','
]
const unit = fc.oneof(
  { weight: 4, arbitrary: fc.string({ unit: 'grapheme', minLength: 1, maxLength: 1 }) },
  { weight: 2, arbitrary: fc.constantFrom(...SPECIAL_CHARS) },
  // any code point but a lone surrogate: unassigned, private-use, noncharacters, astral
  { weight: 1, arbitrary: fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }) }
)
/** Any Unicode string with no lone surrogates, weighted towards controls and escape syntax. */
const text = fc.string({ unit, maxLength: 24 })

/**
 * `text` without a leading U+FEFF, for pairs whose decoder turns bytes back
 * into text. WHATWG `TextDecoder` (in every byte decoder here, and in the
 * runner's own bytes -> text coercion in core/coerce.ts) treats a leading BOM
 * as an encoding signature and drops it, so BOM + "a" comes back as "a".
 * That is the standard decoder contract, applied app-wide rather than per
 * utility; the `bom` utility exists to add/strip one explicitly.
 */
const BOM = String.fromCharCode(0xfeff)
const bytesText = text.filter((s) => !s.startsWith(BOM))

const ALNUM = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('')
/** Identifier-safe key: alnum + underscore only, so it never collides with a
 * format's own delimiters (`.`, `[`, `]`, `=`, etc.) — those escaping paths
 * belong to each utility's own unit tests, not this cross-format property. */
const safeKey = (max = 6) => fc.array(fc.constantFrom(...ALNUM), { minLength: 1, maxLength: max }).map((a) => a.join(''))
const safeKeys = (maxKeys = 4) => fc.uniqueArray(safeKey(), { minLength: 1, maxLength: maxKeys })

/**
 * Strings a data-format writer has to quote or escape to keep them strings:
 * YAML 1.1/1.2 keywords, numbers-in-disguise, dates, sigils, and the
 * delimiters of CSV / query strings / .env / INI.
 */
const TRICKY_SCALARS = [
  '', ' ', 'null', 'Null', 'NULL', '~', 'true', 'false', 'True', 'yes', 'no', 'on', 'off', 'y', 'n',
  '0', '-0', '007', '0x1F', '0o17', '0b101', '1e3', '1_000', '.5', '+1', '-', '.inf', '-.inf', '.nan', 'NaN', 'Infinity',
  '2001-12-14', '12:30:00', '1979-05-27T07:32:00Z', '- a', 'a: b', '#c', '!tag', '&a', '*a', '|', '>', '%x', '@x',
  '"q"', "'q'", ' lead', 'trail ', 'a\nb', 'a\r\nb', 'a,b', 'a;b', 'a=b', 'k=v&x=y', '[s]', '{}', '[]', 'a#b', 'a ;b'
]
const leafString = (maxLength = 8) =>
  fc.oneof({ weight: 3, arbitrary: fc.string({ unit, maxLength }) }, { weight: 1, arbitrary: fc.constantFrom(...TRICKY_SCALARS) })

const smallInt = fc.oneof(fc.integer({ min: -1_000_000, max: 1_000_000 }), fc.maxSafeInteger())
const smallFloat = fc
  .oneof(fc.double({ min: -1000, max: 1000, noNaN: true, noDefaultInfinity: true }), fc.double({ noNaN: true, noDefaultInfinity: true }))
  .filter((n) => Number.isFinite(n) && !Object.is(n, -0))

// =========================================================================
// Base encodings
// =========================================================================

describe('round-trip: base32', () => {
  for (const variant of ['rfc4648', 'rfc4648-hex', 'z-base-32']) {
    for (const padding of [true, false]) {
      roundtrip(
        `base32 (${variant}, padding=${padding})`,
        bytesText,
        (x) => apply('base32_encode', x, { variant, padding }),
        (x) => apply('base32_decode', x, { variant, output: 'text' })
      )
    }
  }
})

describe('round-trip: base58', () => {
  for (const alphabet of ['bitcoin', 'ripple', 'flickr']) {
    roundtrip(
      `base58 (${alphabet})`,
      bytesText,
      (x) => apply('base58_encode', x, { alphabet }),
      (x) => apply('base58_decode', x, { alphabet, output: 'text' })
    )
  }
})

describe('round-trip: base62', () => {
  for (const alphabet of ['standard', 'inverted']) {
    roundtrip(
      `base62 (${alphabet})`,
      bytesText,
      (x) => apply('base62_encode', x, { alphabet }),
      (x) => apply('base62_decode', x, { alphabet, output: 'text' })
    )
  }
})

roundtrip(
  'base64',
  bytesText,
  (x) => apply('base64_encode', x),
  (x) => apply('base64_decode', x)
)

for (const padding of [true, false]) {
  roundtrip(
    `base64url (padding=${padding})`,
    bytesText,
    (x) => apply('base64url_encode', x, { padding }),
    (x) => apply('base64url_decode', x, { output: 'text' })
  )
}

describe('round-trip: base85', () => {
  for (const variant of ['ascii85', 'z85', 'rfc1924']) {
    // '~' is a digit in the rfc1924 alphabet, so `<~ ~>` stripping must not eat payload
    for (const delimiters of [false, true]) {
      roundtrip(
        `base85 (${variant}, delimiters=${delimiters})`,
        bytesText,
        (x) => apply('base85_encode', x, { variant, delimiters }),
        (x) => apply('base85_decode', x, { variant, output: 'text' })
      )
    }
  }
})

roundtrip(
  'base91',
  bytesText,
  (x) => apply('base91_encode', x),
  (x) => apply('base91_decode', x, { output: 'text' })
)

roundtrip(
  'binary',
  bytesText,
  (x) => apply('binary_encode', x),
  (x) => apply('binary_decode', x, { output: 'text' })
)

roundtrip(
  'octal',
  bytesText,
  (x) => apply('octal_encode', x),
  (x) => apply('octal_decode', x, { output: 'text' })
)

roundtrip(
  'hex',
  text,
  (x) => apply('hex_encode', x),
  // hex_decode yields bytes; decode them BOM-preserving so the full `text` arbitrary applies
  async (x) => new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode((await apply('hex_decode', x)) as Uint8Array)
)

// =========================================================================
// Codepoints & escapes
// =========================================================================

describe('round-trip: codepoints', () => {
  for (const format of ['hex', 'decimal', 'u-plus', 'escaped']) {
    roundtrip(
      `codepoints (${format})`,
      text,
      (x) => apply('codepoints_encode', x, { format }),
      (x) => apply('codepoints_decode', x, { format })
    )
  }
})

describe('round-trip: unicode escape', () => {
  const styles = ['js-u', 'js-braces', 'css', 'python', 'java', 'html-hex', 'html-dec']
  const scopes = ['non-ascii', 'all']
  for (const style of styles) {
    for (const scope of scopes) {
      roundtrip(
        `unicode escape (${style}/${scope})`,
        text,
        (x) => apply('unicode_escape_encode', x, { style, scope }),
        (x) => apply('unicode_escape_decode', x),
        50
      )
    }
  }
})

describe('round-trip: html entities', () => {
  const modes = ['named', 'decimal', 'hex']
  const scopes = ['minimal', 'non-ascii', 'all']
  for (const mode of modes) {
    for (const scope of scopes) {
      roundtrip(
        `html entity (${mode}/${scope})`,
        text,
        (x) => apply('html_entity_encode', x, { mode, scope }),
        (x) => apply('html_entity_decode', x),
        50
      )
    }
  }
})

// XML 1.0 §2.2 Char production — everything else cannot legally appear in an
// XML document, not even as a numeric reference, so xml_escape rejects it
// (a real error, not something to work around). Mirrors the utility's own
// `isXmlChar` since it is not exported.
const isXmlChar = (cp: number) =>
  cp === 0x09 || cp === 0x0a || cp === 0x0d || (cp >= 0x20 && cp <= 0xd7ff) || (cp >= 0xe000 && cp <= 0xfffd) || (cp >= 0x10000 && cp <= 0x10ffff)
const xmlSafeText = text.filter((s) => Array.from(s).every((ch) => isXmlChar(ch.codePointAt(0) as number)))

describe('round-trip: xml escape', () => {
  for (const quotes of [true, false]) {
    for (const scope of ['minimal', 'non-ascii']) {
      roundtrip(
        `xml escape (quotes=${quotes}/${scope})`,
        xmlSafeText,
        (x) => apply('xml_escape', x, { quotes, scope }),
        (x) => apply('xml_unescape', x),
        60
      )
    }
  }
})

roundtrip(
  'escape_html / unescape_html',
  text,
  (x) => apply('escape_html', x),
  (x) => apply('unescape_html', x)
)

roundtrip(
  'url_encode / url_decode',
  text,
  (x) => apply('url_encode', x),
  (x) => apply('url_decode', x)
)

roundtrip(
  'quoted-printable',
  bytesText, // QP escapes UTF-8 bytes (=EF=BB=BF), so a leading BOM is dropped on decode like any byte codec
  (x) => apply('quoted_printable_encode', x),
  (x) => apply('quoted_printable_decode', x)
)

roundtrip(
  'json_escape / json_unescape',
  text,
  (x) => apply('json_escape', x),
  (x) => apply('json_unescape', x)
)

// Domain labels: non-empty, no literal '.', and never already 'xn--' prefixed
// (encodeLabel refuses to double-encode). RFC 3492 bootstring itself handles
// arbitrary code points, but "domain" mode splits on '.' per label.
const domainLabel = text.filter((s) => s.length > 0 && !s.includes('.') && !/^xn--/i.test(s))
const domain = fc.array(domainLabel, { minLength: 1, maxLength: 3 }).map((labels) => labels.join('.'))
roundtrip(
  'punycode (domain labels)',
  domain,
  (x) => apply('punycode_encode', x, { mode: 'domain' }),
  (x) => apply('punycode_decode', x, { mode: 'domain' }),
  100
)

// Morse has a fixed, ASCII-uppercase alphabet: case and any character without
// a Morse code are lost by the encoder (by design — `onUnknown: 'skip'` is the
// default). Restricting to the canonical (first-listed, so decode-preferred)
// characters keeps the property meaningful instead of vacuously skipping most
// trials.
const MORSE_CHARS = Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,?\'!/():&;=+-_"$@')
const morseWord = fc.array(fc.constantFrom(...MORSE_CHARS), { minLength: 1, maxLength: 6 }).map((a) => a.join(''))
const morseText = fc.array(morseWord, { minLength: 1, maxLength: 4 }).map((words) => words.join(' '))
roundtrip(
  'morse (restricted alphabet)',
  morseText,
  (x) => apply('morse_encode', x),
  (x) => apply('morse_decode', x),
  100
)

describe('round-trip: code string escape', () => {
  const languages = ['javascript', 'json', 'c', 'java', 'python', 'go', 'csharp', 'php', 'ruby', 'sql']
  // the only languages with a backtick literal; the escaper refuses it for the rest
  const backtickLanguages = new Set(['javascript', 'go', 'sql'])
  // A Go raw string literal cannot contain a backtick and the compiler drops its CRs,
  // so the escaper refuses both rather than emit a literal that means something else.
  const goRawText = text.filter((s) => !s.includes('`') && !s.includes('\r'))
  for (const language of languages) {
    // JSON literals are always double quoted (quote is ignored), so one style covers it
    const quotes = language === 'json' ? ['double'] : ['double', 'single', ...(backtickLanguages.has(language) ? ['backtick'] : [])]
    for (const quote of quotes) {
      for (const escapeNonAscii of [true, false]) {
        roundtrip(
          `code string (${language}, ${quote}, escapeNonAscii=${escapeNonAscii})`,
          language === 'go' && quote === 'backtick' ? goRawText : text,
          (x) => apply('code_string_escape', x, { language, quote, wrap: true, escapeNonAscii }),
          (x) => apply('code_string_unescape', x, { language }),
          30
        )
      }
    }
  }
})

// =========================================================================
// Compression & serialization
// =========================================================================

for (const level of [0, 6, 9]) {
  roundtrip(
    `gzip (level ${level})`,
    bytesText,
    (x) => apply('gzip_compress', x, { level }),
    (x) => apply('gzip_decompress', x, { output: 'text' }),
    60
  )
}

for (const format of ['raw', 'zlib']) {
  roundtrip(
    `deflate (${format})`,
    bytesText,
    (x) => apply('deflate_compress', x, { format }),
    (x) => apply('deflate_decompress', x, { format, output: 'text' }),
    60
  )
}

// A bounded JSON value (no undefined/NaN/Infinity — msgpack has no such
// concepts, matching the accepted `json` value type) for msgpack round trips.
const { msgpackValue } = fc.letrec((tie) => ({
  msgpackValue: fc.oneof(
    { maxDepth: 3 },
    fc.oneof(leafString(), smallInt, smallFloat, fc.boolean(), fc.constant(null)),
    fc.array(tie('msgpackValue') as fc.Arbitrary<unknown>, { maxLength: 4 }),
    fc.dictionary(safeKey(), tie('msgpackValue') as fc.Arbitrary<unknown>, { maxKeys: 4 })
  )
}))
// The root is never a bare string: the runner hands a json-accepting step the
// *parsed* input, so the JSON text `"123"` arrives as the string "123", and
// msgpack_encode then re-parses strings (so direct `apply('{"a":1}')` calls
// work) — encoding it as the integer 123, and a whitespace-only string as no
// bytes. A string nested inside an array/object is unaffected. See the
// quality workstream report: the fix belongs in how coerceInputFor signals
// "already parsed", not in this property.
roundtrip(
  'msgpack',
  msgpackValue.filter((v) => typeof v !== 'string'),
  // the source is the JSON text a user would type; the runner parses it for this json-accepting step
  (x) => apply('msgpack_encode', JSON.stringify(x)),
  (x) => apply('msgpack_decode', x),
  100
)

// =========================================================================
// JSON <-> other data formats
// =========================================================================

/** A bounded JSON value, nulls included, for json_flatten/json_unflatten. */
const { flattenableValue } = fc.letrec((tie) => ({
  flattenableValue: fc.oneof(
    { maxDepth: 3 },
    fc.oneof(leafString(), smallInt, fc.boolean(), fc.constant(null)),
    fc.array(tie('flattenableValue') as fc.Arbitrary<unknown>, { maxLength: 4 }),
    fc.dictionary(safeKey(), tie('flattenableValue') as fc.Arbitrary<unknown>, { maxKeys: 4 })
  )
}))
const flattenRoot = fc.oneof(
  fc.dictionary(safeKey(), flattenableValue, { minKeys: 1, maxKeys: 4 }),
  fc.array(flattenableValue, { minLength: 1, maxLength: 4 })
)
roundtrip(
  'json_flatten / json_unflatten',
  flattenRoot,
  (x) => apply('json_flatten', JSON.stringify(x)),
  async (x) => JSON.parse((await apply('json_unflatten', x)) as string),
  100
)

// TOML has no null, and array-of-tables / nested-array edge cases belong to
// json_to_toml's own unit tests, not this cross-format property — so values
// are string/number/boolean, objects nest up to 2 levels, and arrays hold
// only homogeneous primitives (never objects or other arrays).
const tomlLeaf = fc.oneof(leafString(), smallInt, smallFloat, fc.boolean())
const tomlValue = fc.oneof(tomlLeaf, fc.array(tomlLeaf, { maxLength: 4 }))
const tomlObject = fc.dictionary(safeKey(), tomlValue, { minKeys: 1, maxKeys: 4 })
const tomlRoot = fc.dictionary(safeKey(), fc.oneof({ weight: 3, arbitrary: tomlValue }, { weight: 1, arbitrary: tomlObject }), {
  minKeys: 1,
  maxKeys: 4
})
roundtrip(
  'json_to_toml / toml_to_json',
  tomlRoot,
  (x) => apply('json_to_toml', JSON.stringify(x)),
  async (x) => JSON.parse((await apply('toml_to_json', x)) as string),
  80
)

// json_to_yaml/yaml_to_json round-trips any JSON value, nulls included (the
// no-null restriction is TOML's alone). Leaves include YAML 1.1 keywords and
// numbers-in-disguise ('yes', '0x1F', '~', …) that the writer must quote.
const { yamlValue } = fc.letrec((tie) => ({
  yamlValue: fc.oneof(
    { maxDepth: 3 },
    fc.oneof(leafString(), smallInt, smallFloat, fc.boolean(), fc.constant(null)),
    fc.array(tie('yamlValue') as fc.Arbitrary<unknown>, { maxLength: 4 }),
    fc.dictionary(safeKey(), tie('yamlValue') as fc.Arbitrary<unknown>, { maxKeys: 4 })
  )
}))
const yamlRoot = fc.dictionary(safeKey(), yamlValue, { minKeys: 0, maxKeys: 4 })
roundtrip(
  'json_to_yaml / yaml_to_json',
  yamlRoot,
  (x) => apply('json_to_yaml', JSON.stringify(x)),
  async (x) => JSON.parse((await apply('yaml_to_json', x)) as string),
  80
)

// CSV has no schema: json_to_csv unions column names across records and fills
// gaps with '', so the property only holds cleanly when every record shares
// exactly the same (non-empty) key set — a reasonable case for "flat string
// records" per the spec, and the ragged case belongs to json_to_csv's own
// unit tests.
//
// One-column tables are included on purpose: their empty value is the case a
// bare blank line would lose (`csv_to_json` drops blank lines), so json_to_csv
// must write it as `""`.
const csvRecords = safeKeys(4).chain((keys) =>
  fc.array(
    fc.record(Object.fromEntries(keys.map((k) => [k, leafString(12)]))),
    { minLength: 1, maxLength: 5 }
  )
)
roundtrip(
  'json_to_csv / csv_to_json',
  csvRecords,
  (x) => apply('json_to_csv', JSON.stringify(x), { delimiter: ',', header: true }),
  async (x) => JSON.parse((await apply('csv_to_json', x, { delimiter: ',', header: true, typed: false })) as string),
  100
)

// A flat object of strings, with `nested: 'none'` on the way back so bracket-
// or dot-shaped keys are never reinterpreted as structure — nesting itself is
// json_to_query_string's own concern (arrayFormat/nested params), not this
// cross-format property.
const flatQueryRecord = safeKeys(4).chain((keys) =>
  fc.tuple(...keys.map(() => leafString(12))).map((values) =>
    Object.fromEntries(keys.map((k, i) => [k, values[i]]))
  )
)
roundtrip(
  'json_to_query_string / query_string_to_json',
  flatQueryRecord,
  (x) => apply('json_to_query_string', JSON.stringify(x), { arrayFormat: 'repeat', nested: 'bracket', encode: true }),
  async (x) => JSON.parse((await apply('query_string_to_json', x, { nested: 'none', typed: false })) as string),
  100
)

// .env values are always strings on the way back (env_to_json has no way to
// know a value was ever a number/boolean), and a literal backslash-dollar
// sequence is deliberately unescaped to '$' when `expand` is off — both are
// real properties of the dotenv format, not bugs, so the arbitrary sticks to
// backslash-free values and upper-case identifier keys (already in the shape
// json_to_env's `upperCase` default produces, so sanitization is a no-op).
const ENV_KEY_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('')
const envKey = fc.array(fc.constantFrom(...ENV_KEY_CHARS), { minLength: 1, maxLength: 8 }).map((a) => a.join(''))
const envValue = leafString(16).filter((s) => !s.includes('\\'))
const envRecord = fc
  .uniqueArray(envKey, { minLength: 0, maxLength: 4 })
  .chain((keys) => fc.tuple(...keys.map(() => envValue)).map((values) => Object.fromEntries(keys.map((k, i) => [k, values[i]]))))
roundtrip(
  'json_to_env / env_to_json',
  envRecord,
  (x) => apply('json_to_env', JSON.stringify(x)),
  async (x) => JSON.parse((await apply('env_to_json', x, { typed: false, expand: false })) as string),
  100
)

// INI values stay strings throughout (typed:false on both sides) so the
// true/false/null/numeric-retyping ambiguity documented on ini_to_json's
// `typed` option never enters into it; sections nest one level, and arrays
// are non-empty (json_to_ini silently omits an empty-array key entirely,
// which is a real, if surprising, property of that emitter).
const iniValue = leafString(12)
const iniLeafOrArray = fc.oneof(iniValue, fc.array(iniValue, { minLength: 1, maxLength: 3 }))
const iniRoot = safeKeys(3).chain((topKeys) =>
  fc.tuple(...topKeys.map(() => fc.oneof({ weight: 2, arbitrary: iniLeafOrArray }, { weight: 1, arbitrary: fc.dictionary(safeKey(), iniLeafOrArray, { minKeys: 1, maxKeys: 3 }) }))).map(
    (values) => Object.fromEntries(topKeys.map((k, i) => [k, values[i]]))
  )
)
roundtrip(
  'json_to_ini / ini_to_json',
  iniRoot,
  (x) => apply('json_to_ini', JSON.stringify(x)),
  async (x) => JSON.parse((await apply('ini_to_json', x, { nested: true, typed: false })) as string),
  100
)

// =========================================================================
// Ciphers & involutions
// =========================================================================

const cipherKey = fc.array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')), { minLength: 1, maxLength: 8 }).map((a) =>
  a.join('')
)

// vigenere needs the key on decode too, so it is driven directly rather than
// through the generic `roundtrip` helper (which only threads the ciphertext).
describe('round-trip: vigenere', () => {
  it('decodes what it encodes with the same key', async () => {
    await fc.assert(
      fc.asyncProperty(text, cipherKey, async (x, key) => {
        const params = { key, preserveCase: true, skipNonLetters: true }
        const encoded = await apply('vigenere_encode', x, params)
        const decoded = await apply('vigenere_decode', encoded, params)
        expect(decoded).toEqual(x)
      }),
      { numRuns: 100 }
    )
  })
})

describe('round-trip: rail fence', () => {
  it('decodes what it encodes with the same rails/offset', async () => {
    await fc.assert(
      fc.asyncProperty(text, fc.integer({ min: 1, max: 8 }), fc.integer({ min: -10, max: 10 }), async (x, rails, offset) => {
        const params = { rails, offset }
        const encoded = await apply('rail_fence_encode', x, params)
        const decoded = await apply('rail_fence_decode', encoded, params)
        expect(decoded).toEqual(x)
      }),
      { numRuns: 100 }
    )
  })
})

describe('round-trip: columnar transposition', () => {
  it('decodes what it encodes with the same key (no padding = exact round trip)', async () => {
    await fc.assert(
      fc.asyncProperty(text, cipherKey, async (x, key) => {
        // padChar: '' disables padding on both sides, which is what the
        // utility's own docs call out as the lossless configuration — with a
        // pad character, a message that happens to end in it is ambiguous by
        // construction and is not this property's concern.
        const params = { key, padChar: '' }
        const encoded = await apply('columnar_encode', x, params)
        const decoded = await apply('columnar_decode', encoded, params)
        expect(decoded).toEqual(x)
      }),
      { numRuns: 100 }
    )
  })
})

describe('round-trip: caesar (shift n, then 26-n)', () => {
  it('is the identity for any shift 0-25', async () => {
    await fc.assert(
      fc.asyncProperty(text, fc.integer({ min: 0, max: 25 }), async (x, n) => {
        const once = await apply('caesar', x, { shift: n, preserveCase: true })
        const twice = await apply('caesar', once, { shift: 26 - n, preserveCase: true })
        expect(twice).toEqual(x)
      }),
      { numRuns: 100 }
    )
  })
})

for (const [id, params] of [
  ['atbash', {}],
  ['rot13', {}],
  ['reverse', {}]
] as const) {
  describe(`round-trip: ${id} (involution)`, () => {
    it('applying it twice is the identity', async () => {
      await fc.assert(
        fc.asyncProperty(text, async (x) => {
          const once = await apply(id, x, params)
          const twice = await apply(id, once, params)
          expect(twice).toEqual(x)
        }),
        { numRuns: 100 }
      )
    })
  })
}

// swap_case is scoped to ASCII (per spec): several Unicode letters have
// "special casing" that expands to more than one code point (e.g. U+1F80
// GREEK SMALL LETTER ALPHA WITH PSILI AND YPOGEGRAMMENI uppercases to the
// two-character "ἈΙ"). Swapping case a second time works per code point, so
// it cannot reconstitute the original precomposed character — a genuine
// non-invertibility in Unicode case mapping, not a bug in swap_case.
const asciiText = fc
  .array(fc.integer({ min: 0x20, max: 0x7e }), { maxLength: 40 })
  .map((codes) => codes.map((c) => String.fromCharCode(c)).join(''))
describe('round-trip: swap_case (involution, ASCII)', () => {
  it('applying it twice is the identity', async () => {
    await fc.assert(
      fc.asyncProperty(asciiText, async (x) => {
        const once = await apply('swap_case', x)
        const twice = await apply('swap_case', once)
        expect(twice).toEqual(x)
      }),
      { numRuns: 100 }
    )
  })
})

describe('round-trip: xor cipher (involution)', () => {
  it('applying it twice with the same key is the identity', async () => {
    await fc.assert(
      fc.asyncProperty(bytesText, cipherKey, async (x, key) => {
        const params = { key, keyFormat: 'text' as const }
        const once = (await apply('xor_cipher', x, { ...params, output: 'bytes' })) as Uint8Array
        const twice = await apply('xor_cipher', once, { ...params, output: 'text' })
        expect(twice).toEqual(x)
      }),
      { numRuns: 100 }
    )
  })
})

describe('round-trip: aes (GCM and CBC)', () => {
  for (const mode of ['GCM', 'CBC']) {
    it(`decrypts what it encrypts (${mode})`, async () => {
      await fc.assert(
        fc.asyncProperty(bytesText, fc.string({ unit, minLength: 1, maxLength: 20 }), async (x, password) => {
          const shared = { password, mode, iterations: 10 }
          const encrypted = await apply('aes_encrypt', x, shared)
          if (x === '') return // aes_encrypt short-circuits an empty box to ''
          const decrypted = await apply('aes_decrypt', encrypted, { ...shared, output: 'text' })
          expect(decrypted).toEqual(x)
        }),
        // AES is slow (PBKDF2 + WebCrypto per trial): a handful of runs is
        // enough to catch a real regression without slowing CI down.
        { numRuns: 5 }
      )
    })
  }
})

// windows-1252 is a fixed 256-code-point charset; mirrors charset_encode's own
// (unexported) high-byte table since 0x80-0x9F are not a linear range.
const CP1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f, 0x0090, 0x2018, 0x2019,
  0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178
]
const win1252CodePoint = (byte: number) => (byte >= 0x80 && byte <= 0x9f ? CP1252_HIGH[byte - 0x80] : byte)
const WIN1252_CODEPOINTS = Array.from({ length: 256 }, (_, b) => win1252CodePoint(b))
const win1252Text = fc.array(fc.constantFrom(...WIN1252_CODEPOINTS), { maxLength: 24 }).map((cps) => cps.map((cp) => String.fromCodePoint(cp)).join(''))
roundtrip(
  'charset_encode / charset_decode (windows-1252)',
  win1252Text,
  (x) => apply('charset_encode', x, { charset: 'windows-1252', onUnmappable: 'error' }),
  (x) => apply('charset_decode', x, { charset: 'windows-1252' })
)

roundtrip(
  'data_uri_build / data_uri_parse',
  bytesText,
  (x) => apply('data_uri_build', x, { mime: 'text/plain', base64: true, charset: 'utf-8' }),
  (x) => apply('data_uri_parse', x, { output: 'text' })
)
