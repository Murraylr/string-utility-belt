import { describe, expect, it, vi } from 'vitest'
import { edgeSafeUtilities, getEdgeSafeUtilityMeta, isEdgeSafe, resultToText, runUtilityById } from './registry'

// Importing this module transforms the generated utility manifest, which can
// be slow on a cold Vite cache the first time any test process touches it.
vi.setConfig({ testTimeout: 30000 })

describe('isEdgeSafe / edgeSafeUtilities', () => {
  it('excludes utilities that need dom, main-thread, or eval', () => {
    expect(isEdgeSafe({ env: ['dom'] })).toBe(false)
    expect(isEdgeSafe({ env: ['main'] })).toBe(false)
    expect(isEdgeSafe({ env: ['eval'] })).toBe(false)
    expect(isEdgeSafe({ env: [] })).toBe(true)
    expect(isEdgeSafe({ env: ['wasm'] })).toBe(true)
  })

  it('never lists custom_js (eval + main) but does list the default menu utilities', () => {
    const ids = edgeSafeUtilities().map(m => m.id)
    expect(ids).not.toContain('custom_js')
    for (const id of ['base64_decode', 'base64_encode', 'url_decode', 'url_encode', 'jwt_decode',
      'json_pretty', 'case', 'trim', 'unescape_html', 'sha3']) {
      expect(ids).toContain(id)
    }
  })

  it('is grouped by category and sorted by name within each group', () => {
    const metas = edgeSafeUtilities()
    const seenCategories = new Set<string>()
    let prevCategory = ''
    let prevName = ''
    for (const m of metas) {
      if (m.category !== prevCategory) {
        expect(seenCategories.has(m.category)).toBe(false)
        seenCategories.add(m.category)
        prevCategory = m.category
        prevName = ''
      }
      expect(m.name.localeCompare(prevName)).toBeGreaterThanOrEqual(0)
      prevName = m.name
    }
    expect(metas.length).toBeGreaterThan(0)
  })
})

describe('getEdgeSafeUtilityMeta', () => {
  it('is undefined for an unsafe or unknown id', () => {
    expect(getEdgeSafeUtilityMeta('custom_js')).toBeUndefined()
    expect(getEdgeSafeUtilityMeta('does_not_exist')).toBeUndefined()
  })
  it('returns the meta for a safe id', () => {
    expect(getEdgeSafeUtilityMeta('trim')?.id).toBe('trim')
  })
})

describe('runUtilityById', () => {
  it('runs a utility with declared defaults', async () => {
    expect(await runUtilityById('base64_encode', 'hi')).toBe('aGk=')
    expect(await runUtilityById('trim', '  hi  ')).toBe('hi')
  })

  it('applies the given params over the defaults', async () => {
    expect(await runUtilityById('case', 'hello', { mode: 'upper' })).toBe('HELLO')
    expect(await runUtilityById('case', 'hello world', { mode: 'title' })).toBe('Hello World')
  })

  it('refuses a utility that needs eval/dom/main', async () => {
    await expect(runUtilityById('custom_js', 'x')).rejects.toThrow(/cannot run/)
  })

  it('rejects an unknown utility id', async () => {
    await expect(runUtilityById('does_not_exist', 'x')).rejects.toThrow(/unknown utility/)
  })

  it('surfaces the utility error message on bad input', async () => {
    await expect(runUtilityById('json_pretty', 'not json')).rejects.toThrow()
  })
})

describe('resultToText', () => {
  it('passes strings through and pretty-prints JSON', () => {
    expect(resultToText('plain')).toBe('plain')
    expect(resultToText({ a: [1] })).toBe(JSON.stringify({ a: [1] }, null, 2))
  })

  it('decodes UTF-8 bytes (emoji included) instead of JSON-stringifying the Uint8Array', () => {
    expect(resultToText(new TextEncoder().encode('héllo 😀'))).toBe('héllo 😀')
  })

  it('lists non-UTF-8 bytes losslessly, as the app displays them', () => {
    const text = resultToText(new Uint8Array([0xff, 0x00, 0x1f]))
    expect(text).toContain('hex: [ff, 00, 1f]')
    expect(text).not.toContain('"0":')
  })
})
