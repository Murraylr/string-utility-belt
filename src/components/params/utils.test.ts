import { describe, it, expect } from 'vitest'
import { countMatches, REGEX_MAX_MATCHES, REGEX_MAX_SCAN } from './regexUtils'
import { parseLegacyKeyValue, toPairs } from './keyvalueUtils'
import multiReplace from '@/utilities/multi_replace'

describe('countMatches', () => {
  it('counts every match regardless of a missing g flag', () => {
    expect(countMatches('a', 'i', 'Aaa banana')).toEqual({ count: 6, capped: false, truncated: false })
  })

  it('terminates on zero-length matches, including astral characters under the u flag', () => {
    expect(countMatches('', '', 'abc')?.count).toBe(4)
    expect(countMatches('(?:)', 'u', '😀😀')?.count).toBe(3)
  })

  it('caps the number of matches and the scanned length', () => {
    const many = 'a'.repeat(REGEX_MAX_MATCHES + 50)
    expect(countMatches('a', '', many)).toMatchObject({ count: REGEX_MAX_MATCHES, capped: true })
    const long = 'b'.repeat(REGEX_MAX_SCAN) + 'a'
    expect(countMatches('a', '', long)).toEqual({ count: 0, capped: false, truncated: true })
  })

  it('returns null for an invalid pattern or flags', () => {
    expect(countMatches('(', '', 'x')).toBeNull()
    expect(countMatches('a', 'qq', 'x')).toBeNull()
  })

  it('a sticky pattern counts only the contiguous run at the start', () => {
    expect(countMatches('a', 'y', 'aab a')?.count).toBe(2)
  })
})

describe('parseLegacyKeyValue', () => {
  it('parses both separators, trimming only the arrow form', () => {
    expect(parseLegacyKeyValue('foo => bar\n x \t y \r\nlonely')).toEqual([['foo', 'bar'], [' x ', ' y '], ['lonely', '']])
  })

  it('skips blank and # comment lines and splits on the first separator', () => {
    expect(parseLegacyKeyValue('# c\n\n  \na\tb=>c\nd=>e\tf')).toEqual([['a', 'b=>c'], ['d', 'e\tf']])
  })
})

describe('parseLegacyKeyValue keeps multi_replace output unchanged', () => {
  // The legacy string resolves backslash escapes (`\n`, `\t`, `\#`, `\x41`, `\u{…}`) in
  // `replace` always and in `find` unless `regex` is on; the pairs shape is used verbatim.
  // So converting must resolve them, or "convert to pairs" silently changes the output.
  const cases: Array<{ rules: string; input: string; regex?: boolean }> = [
    { rules: ', => \\n', input: 'a,b,c' },
    { rules: 'x => \\t|\\x41|\\u{1F600}', input: 'axb' },
    { rules: '\\# => hash\n# a comment\n\\\\ => /', input: '#1 C:\\dir' },
    { rules: 'tab\\there\tTAB', input: 'tab\there' },
    { rules: 'C:\\\\(\\w+) => $1\\n', input: 'C:\\Users', regex: true },
    { rules: '\\d+ => <\\#>', input: 'a1b22', regex: true },
  ]
  for (const { rules, input, regex = false } of cases) {
    it(`${JSON.stringify(rules)}${regex ? ' (regex)' : ''}`, async () => {
      const legacy = await multiReplace.apply(input, { rules, regex })
      const pairs = parseLegacyKeyValue(rules, { regexKeys: regex })
      expect(await multiReplace.apply(input, { rules: pairs, regex })).toBe(legacy)
    })
  }

  it('leaves unknown escapes and a trailing backslash alone', () => {
    expect(parseLegacyKeyValue('a\\q => b\\')).toEqual([['a\\q', 'b\\']])
  })
})

describe('toPairs', () => {
  it('normalises arbitrary JSON into string pairs', () => {
    expect(toPairs([['a', 'b'], ['c'], 5, null, [1, true], [{ k: 1 }, null]])).toEqual([
      ['a', 'b'], ['c', ''], ['1', 'true'], ['{"k":1}', ''],
    ])
    expect(toPairs(undefined)).toEqual([])
    expect(toPairs({ a: 1 })).toEqual([])
  })
})
