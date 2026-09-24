import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { build, detectEnv, GENERATED_DIR } from '../../scripts/gen-utilities'
import { MANIFEST } from './_generated/manifest'
import { LOADERS } from './_generated/loaders'
import { STATIC_UTILITIES } from './_generated/static'
import { UTILITIES } from './index'

describe('generated utility manifest', () => {
  it('is up to date — run `npm run gen` if this fails', async () => {
    const { files } = await build()
    const stale = Object.entries(files)
      .filter(([name, content]) => readFileSync(path.join(GENERATED_DIR, name), 'utf8') !== content)
      .map(([name]) => name)
    expect(stale).toEqual([])
  }, 120000)

  it('covers exactly the utilities the eager registry discovers', () => {
    const ids = UTILITIES.map(u => u.id).sort()
    expect(MANIFEST.map(m => m.id).sort()).toEqual(ids)
    expect(Object.keys(LOADERS).sort()).toEqual(ids)
    expect(STATIC_UTILITIES.map(u => u.id).sort()).toEqual(ids)
  })

  it('carries metadata only — no code', () => {
    for (const m of MANIFEST) expect((m as any).apply).toBeUndefined()
  })

  it('loads the real module through a lazy loader', async () => {
    const mod = await LOADERS.base32_encode()
    expect(mod.default.id).toBe('base32_encode')
    expect(await mod.default.apply('foo', { variant: 'rfc4648', padding: true })).toBe('MZXW6===')
  })
})

describe('environment detection', () => {
  it('flags real DOM, WASM and eval usage', () => {
    expect(detectEnv("const d = new DOMParser().parseFromString(s, 'text/xml')")).toEqual(['dom'])
    expect(detectEnv('const el = document.createElement("a")')).toEqual(['dom'])
    expect(detectEnv("const { sha3 } = await import('hash-wasm')")).toEqual(['wasm'])
    expect(detectEnv("const T = (await import('turndown')).default")).toEqual(['dom'])
    expect(detectEnv('const f = new Function("x", body)')).toEqual(['eval'])
  })

  it('ignores prose, data and guarded optional use', () => {
    expect(detectEnv('// parses a YAML document.\nconst x = 1')).toEqual([])
    expect(detectEnv("const m = 'application/vnd.ms-word.document.macroenabled.12'")).toEqual([])
    expect(detectEnv("if (head.includes('word/document.xml')) return 1")).toEqual([])
    expect(detectEnv("if (typeof DOMParser !== 'undefined') { new DOMParser() }")).toEqual([])
    expect(detectEnv('const r = retrieval(x)')).toEqual([])
  })

  it('matches the known DOM and WASM utilities', () => {
    const env = (e: string) => MANIFEST.filter(m => m.env.includes(e as any)).map(m => m.id).sort()
    expect(env('dom')).toEqual(['html_table_to_csv', 'html_to_markdown', 'xml_to_json'])
    expect(env('wasm')).toEqual(['argon2_hash', 'bcrypt_hash', 'bcrypt_verify', 'blake', 'checksum', 'sha3'])
  })
})
