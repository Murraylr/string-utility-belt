/**
 * Shipped example pipelines: onboarding and "I didn't know it could do that".
 * Every step here is a real utility id with real params (see each utility's own
 * `index.ts` for the exact param names) — `presets.test.ts` runs every one of these
 * through the eager pipeline runner and checks the output byte-for-byte.
 */
import type { PipelineStep } from '@/types/utility'

export interface Preset {
  id: string
  name: string
  description: string
  sampleInput: string
  steps: PipelineStep[]
  /** Exact output of running `steps` on `sampleInput`, as `formatForDisplay` renders it. */
  expectedOutput: string
}

const u = (id: string, utilityId: string, params: Record<string, unknown> = {}): PipelineStep =>
  ({ id, utilityId, enabled: true, params })

export const PRESETS: Preset[] = [
  {
    id: 'decode-jwt',
    name: 'Decode a JWT',
    description: 'Split a JSON Web Token into its header and payload, with exp/iat rendered as real dates.',
    sampleInput:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    steps: [u('s1', 'jwt_decode', { part: 'all' })],
    expectedOutput: JSON.stringify(
      {
        header: { alg: 'HS256', typ: 'JWT' },
        payload: { sub: '1234567890', name: 'John Doe', iat: 1516239022 },
        signature: 'SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
        expiresAt: null,
        issuedAt: '2018-01-18T01:30:22.000Z',
        notBefore: null,
        isExpired: false,
      },
      null,
      2
    ),
  },
  {
    id: 'fix-mojibake',
    name: 'Fix mojibake',
    description: 'Repair text that was UTF-8 but got displayed as Latin-1/Windows-1252 ("cafÃ©" → "café").',
    // UTF-8 bytes of "café, naïve, München, José", each byte re-read as one Latin-1 char.
    sampleInput: 'cafÃ©, naÃ¯ve, MÃ¼nchen, JosÃ©',
    steps: [u('s1', 'charset_decode', { charset: 'utf-8', fatal: false })],
    expectedOutput: 'café, naïve, München, José',
  },
  {
    id: 'csv-to-json',
    name: 'CSV to JSON',
    description: 'Parse a header row + typed values into a pretty-printed array of objects.',
    sampleInput: 'name,age,active\nAlice,30,true\nBob,25,false',
    steps: [u('s1', 'csv_to_json', { delimiter: 'auto', header: true, typed: true, trim: true, indent: 2 })],
    expectedOutput: JSON.stringify(
      [
        { name: 'Alice', age: 30, active: true },
        { name: 'Bob', age: 25, active: false },
      ],
      null,
      2
    ),
  },
  {
    id: 'double-url-decode',
    name: 'Double URL-decode',
    description: 'Some systems percent-encode twice (a value pasted from a URL that was itself encoded); undo both passes.',
    sampleInput: 'hello%2520world%2521',
    steps: [u('s1', 'url_decode'), u('s2', 'url_decode')],
    expectedOutput: 'hello world!',
  },
  {
    id: 'strong-password',
    name: 'Strong password',
    description: '20 random characters with upper/lower case, digits and symbols (look-alikes excluded), from the browser\'s crypto RNG — a fresh password on every run.',
    sampleInput: '',
    steps: [
      u('s1', 'password_generator', {
        mode: 'random', length: 20, words: 4, separator: '-',
        uppercase: true, digits: true, symbols: true, excludeAmbiguous: true, count: 1, seed: 0,
      }),
    ],
    // seed 0 = crypto-random, so the preset has no fixed output: the test re-runs these
    // exact steps with `seed: 42` to pin this one, and checks the real preset by shape
    expectedOutput: 'K*&7vHM=ULntT9HmasqY',
  },
  {
    id: 'base64-gunzip-json',
    name: 'Base64 → gunzip → pretty JSON',
    description:
      'Paste a base64 blob of gzipped JSON (a common API, cookie and log format): decode it to raw bytes, gunzip them, and pretty-print the JSON.',
    sampleInput: 'H4sIAAl6tGoAA6tWykxRsjLUUcpLzE1VslJyTElU8MkvS81JTE5V0lEqSUwvVrKKVspNLMkAcpPzcwtKSzLz0pViawGBvw3DOgAAAA==',
    steps: [
      u('s1', 'base64url_decode', { output: 'bytes' }), // also reads the standard +/ alphabet
      u('s2', 'gzip_decompress', { output: 'text' }),
      u('s3', 'json_pretty', { indent: 2 }),
    ],
    expectedOutput: JSON.stringify({ id: 1, name: 'Ada Lovelace', tags: ['math', 'computing'] }, null, 2),
  },
  {
    id: 'slugify-lines',
    name: 'Slugify every line',
    description: 'Turn a list of titles, one per line, into URL-safe kebab-case slugs: accents stripped, punctuation collapsed to single hyphens, lower-cased.',
    sampleInput: '10 Tips for Writing Better Git Commit Messages!\nCafé déjà vu — a review\n  Rock & Roll  ',
    steps: [
      u('s1', 'diacritics'),
      // the newline is excluded from the run, so every line stays its own slug
      u('s2', 'replace', { pattern: '[^A-Za-z0-9\\n]+', replacement: '-', regex: true, flags: 'g' }),
      u('s3', 'replace', { pattern: '^-+|-+$', replacement: '', regex: true, flags: 'gm' }),
      u('s4', 'case', { mode: 'lower' }),
    ],
    expectedOutput: '10-tips-for-writing-better-git-commit-messages\ncafe-deja-vu-a-review\nrock-roll',
  },
  {
    id: 'extract-unique-emails',
    name: 'Extract unique emails',
    description: 'Pull every email address out of pasted text: lower-cased first so ADA@ and ada@ count once, then deduped and sorted.',
    sampleInput: 'Contact ada@example.com or ADA@example.com, also bob@example.org.\nAlso reach ada@example.com again.',
    steps: [
      u('s1', 'case', { mode: 'lower' }),
      u('s2', 'extract_preset', { type: ['emails'], unique: true, sort: true, separator: '\n', count: false }),
    ],
    expectedOutput: 'ada@example.com\nbob@example.org',
  },
  {
    id: 'sql-in-list',
    name: 'SQL IN-list builder',
    description: "Turn one value per line into a quoted, comma-joined SQL IN (...) list.",
    sampleInput: 'apple\nbanana\ncherry',
    steps: [u('s1', 'line_affix', { prefix: "'", suffix: "'", skipBlank: true, joinWith: ', ' })],
    expectedOutput: "'apple', 'banana', 'cherry'",
  },
  {
    id: 'hash-three-ways',
    name: 'Hash three ways',
    description: 'Fork the input into three lanes — MD5, SHA-1, SHA-256 — and concatenate the digests.',
    sampleInput: 'The quick brown fox jumps over the lazy dog',
    steps: [
      {
        id: 'b1',
        type: 'branch',
        enabled: true,
        branches: [
          [u('l1', 'md5')],
          [u('l2', 'hash', { algo: 'SHA-1' })],
          [u('l3', 'hash', { algo: 'SHA-256' })],
        ],
        merge: { mode: 'concat', separator: '\n' },
      },
    ],
    expectedOutput: [
      '9e107d9d372bb6826bd81d3542a419d6',
      '2fd4e1c67a2d28fced849ee1bb76e7391b93eb12',
      'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592',
    ].join('\n'),
  },
  {
    id: 'clean-word-paste',
    name: 'Clean text pasted from Word',
    description: 'Straighten curly quotes/dashes/ellipses, strip invisible characters, and collapse extra whitespace.',
    sampleInput: 'This is a “test”—with an en dash–and an ellipsis…\n\n\n\nExtra   spaces and​hidden characters.',
    steps: [
      u('s1', 'smart_quotes', { direction: 'to-straight', quotes: true, dashes: true, ellipsis: true, locale: 'en' }),
      u('s2', 'remove_invisible', { mode: 'remove' }),
      u('s3', 'collapse_whitespace', { spaces: true, newlines: true, trim: true, tabsToSpaces: false, unicodeSpaces: true }),
    ],
    expectedOutput: 'This is a "test"---with an en dash--and an ellipsis...\n\nExtra spaces andhidden characters.',
  },
  {
    id: 'hex-dump',
    name: 'Hex dump',
    description: 'xxd-style offset + hex + ASCII view of the input bytes.',
    sampleInput: 'Hello, World!',
    steps: [u('s1', 'hex_dump', { width: 16, uppercase: false, showAscii: true, showOffset: true })],
    expectedOutput: '00000000  48 65 6c 6c 6f 2c 20 57  6f 72 6c 64 21           |Hello, World!|',
  },
  {
    id: 'json-to-yaml',
    name: 'JSON to YAML',
    description: 'Convert a JSON object to YAML.',
    sampleInput: JSON.stringify({ name: 'Ada', roles: ['admin', 'user'] }),
    steps: [u('s1', 'json_to_yaml', { indent: 2, lineWidth: 80, sortKeys: false })],
    expectedOutput: 'name: Ada\nroles:\n  - admin\n  - user\n',
  },
  {
    id: 'unix-timestamp-to-dates',
    name: 'Unix timestamp to dates',
    description: 'Auto-detect one timestamp per line and expand each into every common format.',
    sampleInput: '1700000000\n1717200000',
    steps: [u('s1', 'timestamp_convert', { to: 'all', timezone: 'UTC', perLine: true })],
    expectedOutput: JSON.stringify(
      [
        {
          input: '1700000000', detected: 'unix-seconds', timezone: 'UTC', utcOffset: '+00:00',
          unix: 1700000000, unixMs: 1700000000000,
          iso: '2023-11-14T22:13:20.000Z', isoUtc: '2023-11-14T22:13:20.000Z',
          rfc2822: 'Tue, 14 Nov 2023 22:13:20 +0000', http: 'Tue, 14 Nov 2023 22:13:20 GMT',
          sql: '2023-11-14 22:13:20', local: 'Tuesday, November 14, 2023 at 10:13:20 PM UTC',
          relative: '3 years ago', dayOfWeek: 'Tuesday', dayOfYear: 318, isLeapYear: false,
        },
        {
          input: '1717200000', detected: 'unix-seconds', timezone: 'UTC', utcOffset: '+00:00',
          unix: 1717200000, unixMs: 1717200000000,
          iso: '2024-06-01T00:00:00.000Z', isoUtc: '2024-06-01T00:00:00.000Z',
          rfc2822: 'Sat, 01 Jun 2024 00:00:00 +0000', http: 'Sat, 01 Jun 2024 00:00:00 GMT',
          sql: '2024-06-01 00:00:00', local: 'Saturday, June 1, 2024 at 12:00:00 AM UTC',
          relative: '2 years ago', dayOfWeek: 'Saturday', dayOfYear: 153, isLeapYear: true,
        },
      ],
      null,
      2
    ),
  },
]
