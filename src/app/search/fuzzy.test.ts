import { describe, it, expect } from 'vitest'
import { fuzzyScore, searchUtilities, type UtilitySearchResult } from './fuzzy'
import type { UtilityMeta } from '@/core/registry'

const meta = (over: Partial<UtilityMeta> = {}): UtilityMeta => ({
  id: 'case', name: 'case', category: 'String Ops', description: 'change letter case',
  accepts: 'string', produces: 'string', params: {}, tags: [], aliases: [], env: [], streamable: false,
  exampleCount: 0, ...over,
})

describe('fuzzyScore', () => {
  it('matches a subsequence, case- and diacritic-insensitively', () => {
    expect(fuzzyScore('for', 'format')).not.toBeNull()
    expect(fuzzyScore('FOR', 'format')).not.toBeNull()
    expect(fuzzyScore('cafe', 'café')).not.toBeNull()
    expect(fuzzyScore('café', 'cafe')).not.toBeNull()
  })

  it('rejects a non-subsequence', () => {
    expect(fuzzyScore('xyz', 'format')).toBeNull()
    expect(fuzzyScore('', 'format')).toBeNull()
  })

  it('scores a contiguous prefix match higher than a scattered one', () => {
    const prefix = fuzzyScore('for', 'format')!
    const scattered = fuzzyScore('for', 'flow_bar')!
    expect(prefix).not.toBeNull()
    expect(scattered).not.toBeNull()
    expect(prefix.score).toBeGreaterThan(scattered.score)
  })

  it('scores a word-boundary match higher than a mid-word one', () => {
    const boundary = fuzzyScore('case', 'format_case')!
    const midword = fuzzyScore('case', 'lowercased')!
    expect(boundary.score).toBeGreaterThan(midword.score)
  })

  it('rewards consecutive characters over the same characters spread out', () => {
    const tight = fuzzyScore('abc', 'xabcx')!
    const loose = fuzzyScore('abc', 'xaxbxcx')!
    expect(tight.score).toBeGreaterThan(loose.score)
  })

  it('returns index ranges into the original (unfolded) text', () => {
    const m = fuzzyScore('for', 'format')!
    expect(m.ranges).toEqual([{ start: 0, end: 3 }])
    const scattered = fuzzyScore('fmt', 'format')!
    // f(0), m(3), t(5): three separate single-char ranges
    expect(scattered.ranges).toEqual([{ start: 0, end: 1 }, { start: 3, end: 4 }, { start: 5, end: 6 }])
  })
})

describe('searchUtilities', () => {
  const metas = [
    meta({ id: 'case', name: 'case', aliases: ['uppercase', 'lowercase'], tags: ['text'] }),
    meta({ id: 'trim', name: 'trim', description: 'remove surrounding whitespace' }),
    meta({ id: 'walrus_op', name: 'walrus operator explainer', description: 'plain-English explanation' }),
    meta({ id: 'other', name: 'other thing', description: 'mentions a walrus in passing' }),
  ]

  it('returns input order, unranked, for an empty query', () => {
    const results = searchUtilities('', metas)
    expect(results.map(r => r.meta.id)).toEqual(metas.map(m => m.id))
    expect(results.every(r => r.score === 0)).toBe(true)
  })

  it('finds a utility by alias even when the name does not match', () => {
    const results = searchUtilities('uppercase', metas)
    expect(results.some(r => r.meta.id === 'case')).toBe(true)
  })

  it('finds a utility by tag', () => {
    const results = searchUtilities('text', metas)
    expect(results.some(r => r.meta.id === 'case')).toBe(true)
  })

  it('ranks a name match above a description-only match for the same text', () => {
    const results = searchUtilities('walrus', metas)
    const byId = (id: string) => results.findIndex(r => r.meta.id === id)
    expect(byId('walrus_op')).toBeGreaterThanOrEqual(0)
    expect(byId('other')).toBeGreaterThanOrEqual(0)
    expect(byId('walrus_op')).toBeLessThan(byId('other'))
  })

  it('sets nameRanges only when the match came from the name field', () => {
    const results = searchUtilities('uppercase', metas)
    const hit = results.find(r => r.meta.id === 'case') as UtilitySearchResult
    expect(hit.nameRanges).toEqual([])
  })

  it('excludes utilities that match nothing', () => {
    const results = searchUtilities('zzzznotfound', metas)
    expect(results).toEqual([])
  })

  it('ranks an exact alias hit above a scattered name hit', () => {
    // "btoa" is scattered across "byte order mark" but is base64_encode's exact alias
    const results = searchUtilities('btoa', [
      meta({ id: 'bom', name: 'byte order mark', description: 'add or remove a bom' }),
      meta({ id: 'bit_ops', name: 'bit operations', description: 'bitwise and, or, xor' }),
      meta({ id: 'base64_encode', name: 'base64_encode', aliases: ['btoa'], tags: ['b64'] }),
    ])
    expect(results[0].meta.id).toBe('base64_encode')
  })

  it('matches multi-word queries in any word order', () => {
    const results = searchUtilities('encode base64', [
      meta({ id: 'aes_encrypt', name: 'aes encrypt', description: 'encrypt text, output as base64' }),
      meta({ id: 'base64_encode', name: 'base64 encode' }),
    ])
    expect(results[0].meta.id).toBe('base64_encode')
    expect(results[0].nameRanges).toEqual([{ start: 0, end: 6 }, { start: 7, end: 13 }])
  })

  it('stays fast enough to run on every keystroke over ~250 utilities', () => {
    const words = ['base64', 'encode', 'decode', 'json', 'yaml', 'hash', 'lines', 'sort', 'trim', 'case', 'url', 'hex']
    const many = Array.from({ length: 250 }, (_, i) => meta({
      id: `util_${i}`,
      name: `${words[i % words.length]} ${words[(i * 7) % words.length]} ${i}`,
      aliases: [`alias${i}`], tags: words.slice(i % 5, (i % 5) + 5),
      description: 'Convert the input between formats, with options to fold case, trim whitespace, sort lines, and output a table, JSON or CSV.',
    }))
    const queries = ['b', 'ba', 'base', 'base64', 'base64 d', 'json', 'sort lines', 'xyz', 'case', 'ab']
    for (const q of queries) searchUtilities(q, many) // warm the per-text cache and the JIT
    const t0 = performance.now()
    for (let k = 0; k < 3; k++) for (const q of queries) searchUtilities(q, many)
    const perQuery = (performance.now() - t0) / (3 * queries.length)
    // the first implementation took ~150 ms per query at this size; generous bound for loaded machines
    expect(perQuery).toBeLessThan(30)
  })
})

describe('fuzzyScore ranges', () => {
  it('highlights the characters that were actually scored', () => {
    // the best path is the consecutive "ab" at the end, not a(0) + b(5)
    expect(fuzzyScore('ab', 'a-a-ab')!.ranges).toEqual([{ start: 4, end: 6 }])
  })

  it('never splits a surrogate pair', () => {
    const text = '\u{1F601}\u{1F600}'
    const m = fuzzyScore('\u{1F600}', text)!
    expect(m).not.toBeNull()
    expect(m.ranges).toEqual([{ start: 2, end: 4 }])
    // a lone low surrogate in the query still highlights the whole emoji
    const partial = fuzzyScore('\u{DE00}', text)!
    expect(partial.ranges).toEqual([{ start: 2, end: 4 }])
  })

  it('merges ranges from several query words', () => {
    expect(fuzzyScore('decode base64', 'base64 decode')!.ranges).toEqual([{ start: 0, end: 6 }, { start: 7, end: 13 }])
  })
})

describe('fuzzyScore unicode folding', () => {
  it('treats a decomposed (NFD) query like its precomposed form', () => {
    // e.g. pasted from macOS: "e" + U+0301 instead of "é"
    expect(fuzzyScore('café', 'café')).not.toBeNull()
    expect(fuzzyScore('café', 'cafe')).not.toBeNull()
    expect(fuzzyScore('café', 'café')).not.toBeNull()
  })

  it('does not reduce a precomposed syllable to its first letter (Hangul)', () => {
    // NFD splits 한 into three jamo; it must not match 하 (a different syllable)
    expect(fuzzyScore('하', '한')).toBeNull()
    expect(fuzzyScore('한', '한국어')!.ranges).toEqual([{ start: 0, end: 1 }])
  })

  it('highlights a decomposed letter together with its combining marks', () => {
    expect(fuzzyScore('cafe', 'café')!.ranges).toEqual([{ start: 0, end: 5 }])
  })
})
