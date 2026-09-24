/**
 * Regression guard for regexes that went quadratic on attacker-sized input. Each
 * trimmed a trailing run (`/=+$/`, `/(?:\r\n|\n|\r)+$/`, `/[^\p{L}…]+$/u`, `/\s*…$/`)
 * with a pattern V8 retries from every position inside a long run that does NOT reach
 * the end of the string, so 160k chars took 10–35 s. A share link (up to 2M chars of
 * input, compressed to almost nothing), a pasted file or one `POST /api/run` could
 * deliver such a run. Each case is timed on a run that was ~10 s before the fix.
 */
import { describe, it, expect } from 'vitest'
import { UTIL_MAP } from '../index'
import { defaultParams, resolveParams } from '../../core/params'
import { coerceInputFor, resolveAccepts } from '../../core/coerce'

const N = 160_000
const EQ = '='.repeat(N) + 'x'

const CASES: [id: string, input: string, params: Record<string, unknown>][] = [
  ['base64url_decode', EQ, {}],
  ['mime_from_magic', EQ, {}],
  ['aes_decrypt', EQ, { password: 'p' }],
  ['checksum_verify', 'abc', { expected: 'A' + EQ }],
  ['deflate_decompress', EQ, {}],
  ['gzip_decompress', EQ, {}],
  ['jwt_decode', 'eyJhIjoxfQ.' + EQ + '.sig', {}],
  ['jwt_verify', 'eyJhbGciOiJIUzI1NiJ9.' + EQ + '.sig', { secret: 'k', key: 'k' }],
  ['hmac', 'abc', { key: 'A' + EQ, keyFormat: 'base64' }],
  ['normalize_line_endings', 'a' + '\n'.repeat(N) + 'x', { finalNewline: 'remove' }],
  ['text_stats', 'x' + '['.repeat(N) + 'x', {}],
  ['number_words', '1' + ' '.repeat(N) + 'x', {}],
  // `/^(\s*)([\s\S]*?)(\s*)$/` re-scans the space run for every character the lazy group grows by
  ['ordinalize', '1' + ' '.repeat(N) + 'x', {}],
  ['roman_numerals', 'X' + ' '.repeat(N) + 'x', {}],
  // legacy string rules, trimmed with /^\s+|\s+$/g
  ['multi_replace', 'abc', { rules: 'a' + ' '.repeat(N) + 'b => c' }],
  // sentence splitting on a run of terminators that is not followed by whitespace
  ['text_stats', 'a' + '.'.repeat(N) + 'b', {}],
  // trimming joined lines with /[^\S…]+$/
  ['unwrap', 'a' + ' '.repeat(N) + 'b\nc', {}],
  // /[a-z0-9._-]*(?:bot|…)\)/i retried from every position of a long token
  ['user_agent_parse', 'a' + 'x'.repeat(N) + 'b', {}],
  // trimming the pattern's surrounding line breaks with /^[\r\n]+|[\r\n]+$/g
  ['regex_explain', 'a' + '\n'.repeat(N) + 'b', {}],
]

describe('no quadratic trailing-run regexes', () => {
  it.each(CASES)('%s stays linear on a long inner run', async (id, input, params) => {
    const u = UTIL_MAP[id]
    const t0 = performance.now()
    try {
      await u.apply(coerceInputFor(input, resolveAccepts(u.accepts, input)), resolveParams(u, { ...defaultParams(u), ...params }))
    } catch { /* rejecting the input is fine; hanging on it is not */ }
    expect(performance.now() - t0).toBeLessThan(1500)
  }, 60_000)

  it('still strips what the old patterns stripped', async () => {
    expect(await UTIL_MAP.base64url_decode.apply('aGk==', {})).toBe('hi')
    expect(await UTIL_MAP.normalize_line_endings.apply('a\n\r\n\n', { mode: 'lf', finalNewline: 'remove' })).toBe('a')
    expect(await UTIL_MAP.jwt_decode.apply('eyJhbGciOiJub25lIn0.eyJhIjoxfQ==.', {})).toMatchObject({ payload: { a: 1 } })
  })
})
