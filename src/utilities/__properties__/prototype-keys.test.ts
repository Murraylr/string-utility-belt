/**
 * Share links, imported pipelines and `POST /api/run` hand utilities arbitrary select
 * values and input words. A lookup like `ALPHABETS[name]` then finds Object.prototype
 * members: `alphabet: 'constructor'` made base58/base62 encode in base 1 — an endless
 * loop that grew a string until the engine gave up (~10 s and ~1 GB per step), and
 * entity/extension tables answered with native function source. Every such value must
 * either be refused quickly or be treated as the plain unknown name it is.
 */
import { describe, it, expect } from 'vitest'
import { UTILITIES, UTIL_MAP } from '../index'
import { defaultParams, resolveParams } from '../../core/params'
import { coerceInputFor, resolveAccepts } from '../../core/coerce'
import type { Utility } from '../../types/utility'

const KEYS = ['constructor', '__proto__', 'toString', 'valueOf', 'hasOwnProperty', '__defineGetter__', 'isPrototypeOf']
/** Needs a password/key or is slow by design; none takes a select that indexes a table. */
const SKIP = new Set(['argon2_hash', 'bcrypt_hash', 'bcrypt_verify', 'pbkdf2', 'aes_encrypt', 'aes_decrypt', 'custom_js', 'qr_code'])
const LEAK = /\[native code\]|undefinedundefined|\[object Object\]/

async function run(u: Utility, input: string, params: Record<string, unknown>) {
  const t0 = performance.now()
  let text = ''
  try {
    const out = await u.apply(coerceInputFor(input, resolveAccepts(u.accepts, input)), resolveParams(u, params))
    text = typeof out === 'string' ? out : JSON.stringify(out) ?? ''
  } catch { /* refusing the value is fine */ }
  return { ms: performance.now() - t0, text }
}

const withSelects = UTILITIES.filter(u => !SKIP.has(u.id) &&
  Object.values(u.params ?? {}).some(s => s.kind === 'select' || s.kind === 'multiselect'))

describe('Object.prototype names are never looked up as table entries', () => {
  it.each(withSelects.map(u => [u.id, u] as const))('%s select params', async (_id, u) => {
    for (const [key, spec] of Object.entries(u.params ?? {})) {
      if (spec.kind !== 'select' && spec.kind !== 'multiselect') continue
      for (const name of KEYS) {
        if (spec.options.includes(name)) continue
        const value = spec.kind === 'select' ? name : [name]
        const { ms, text } = await run(u, 'hello world', { ...defaultParams(u), [key]: value })
        expect(ms, `${key}=${name}`).toBeLessThan(1000)
        expect(text, `${key}=${name}`).not.toMatch(LEAK)
      }
    }
  }, 60_000)

  it.each([
    ['mime_lookup', 'constructor'],
    ['mime_lookup', '__proto__'],
    ['mime_lookup', 'file.toString'],
    ['strip_html_tags', '&constructor; &toString; &valueOf; &__proto__;'],
  ])('%s input %j', async (id, input) => {
    const u = UTIL_MAP[id]
    const { text } = await run(u, input, defaultParams(u))
    expect(text).not.toMatch(LEAK)
  })

  it('still resolves the real names', async () => {
    expect(await UTIL_MAP.base58_encode.apply('hello world', { alphabet: 'bitcoin' })).toBe('StV1DL6CwTryKyV')
    expect(JSON.stringify(await UTIL_MAP.mime_lookup.apply('report.pdf', defaultParams(UTIL_MAP.mime_lookup)))).toContain('application/pdf')
    expect(await UTIL_MAP.strip_html_tags.apply('a&amp;b &eacute;', defaultParams(UTIL_MAP.strip_html_tags))).toBe('a&b é')
  })
})
