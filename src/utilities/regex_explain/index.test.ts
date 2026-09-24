import { describe, it, expect } from 'vitest'
import util from './index'

describe('regex_explain', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('regex_explain')
    expect(util.name).toBe('regex explain')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params).sort()).toEqual(['flags', 'format', 'pattern'].sort())
    expect(util.params.pattern.kind).toBe('regex')
    expect((util.params.pattern as { flagsParam?: string }).flagsParam).toBe('flags')
  })

  it('explains a realistic pattern as an indented tree', async () => {
    const out = String(await util.apply('^(\\d{4})-(\\d{2})$', {}))
    expect(out).toContain('pattern:   /^(\\d{4})-(\\d{2})$/')
    expect(out).toContain('^        —  the start of the string (or of a line when the m flag is set)')
    expect(out).toContain('( … )    —  capturing group 1')
    expect(out).toContain('  \\d{4}  —  any digit (0-9), repeated exactly 4 times')
    expect(out).toContain('capture groups: 1, 2')
  })

  it('returns a real object (not a JSON string) in json format', async () => {
    const out: any = await util.apply('a{2,4}', { format: 'json' })
    expect(typeof out).toBe('object')
    expect(out.pattern).toBe('a{2,4}')
    expect(out.groupCount).toBe(0)
    expect(out.tree).toHaveLength(1)
    expect(out.tree[0].quantifier).toBe('{2,4}')
    expect(out.tree[0].description).toBe(
      'the character "a", repeated between 2 and 4 times, as many as possible (greedy)'
    )
  })

  it('handles empty input without throwing', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('\n', { format: 'tree' })).toBe('')
    expect(await util.apply('', { format: 'json' })).toEqual({})
  })

  it('uses the pattern param when set and understands /pattern/flags literals', async () => {
    // the pattern param wins over the input
    const out: any = await util.apply('IGNORED', { pattern: '\\w+', format: 'json' })
    expect(out.pattern).toBe('\\w+')

    const literal: any = await util.apply('/^ab$/gi', { format: 'json' })
    expect(literal.pattern).toBe('^ab$')
    expect(literal.flags).toBe('gi')
    expect(literal.flagDescriptions.map((f: any) => f.flag)).toEqual(['g', 'i'])
  })

  it('describes every flag it is given', async () => {
    const out = String(await util.apply('abc', { flags: 'dgimsuvy' }))
    expect(out).toContain('d = hasIndices')
    expect(out).toContain('g = global — find every match, not just the first')
    expect(out).toContain('i = ignore case')
    expect(out).toContain('m = multiline')
    expect(out).toContain('s = dotAll')
    expect(out).toContain('u = unicode')
    expect(out).toContain('v = unicodeSets')
    expect(out).toContain('y = sticky')
    // every flag handed in must be described — none silently dropped
    const json: any = await util.apply('abc', { flags: 'dgimsuvy', format: 'json' })
    expect(json.flagDescriptions.map((f: any) => f.flag)).toEqual(
      ['d', 'g', 'i', 'm', 's', 'u', 'v', 'y']
    )
    expect(json.flagDescriptions.every((f: any) => typeof f.meaning === 'string' && f.meaning)).toBe(true)
    const none = String(await util.apply('abc', { flags: '' }))
    expect(none).toContain('flags:     (none)')
  })

  it('handles groups, lookaround, alternation and back-references', async () => {
    const out: any = await util.apply('(?<year>\\d{4})|(cat|dog)', { format: 'json' })
    expect(out.groups).toEqual([
      { number: 1, name: 'year' },
      { number: 2, name: '' }
    ])
    expect(out.tree[0].type).toBe('alternation')
    expect(out.tree[0].children).toHaveLength(2)
    expect(out.tree[0].children[0].children[0].description).toBe('capturing group 1, named "year"')

    const look = String(await util.apply('(?=a)(?!b)(?<=c)(?<!d)(?:e)', {}))
    expect(look).toContain('positive lookahead')
    expect(look).toContain('negative lookahead')
    expect(look).toContain('positive lookbehind')
    expect(look).toContain('negative lookbehind')
    expect(look).toContain('a group that is NOT captured')

    const refs: any = await util.apply('(a)\\1\\k<n>', { format: 'json' })
    expect(refs.tree[1].description).toBe('the same text that capturing group 1 matched')
    expect(refs.tree[2].description).toBe('the same text that the group named "n" matched')
  })

  it('describes character classes, quantifiers and unicode property escapes', async () => {
    const cls: any = await util.apply('[^a-z0-9_\\s]', { format: 'json' })
    expect(cls.tree[0].type).toBe('negated_character_class')
    expect(cls.tree[0].description).toBe(
      'any one character NOT in the set: "a"-"z" (lowercase letters), "0"-"9" (digits), "_" and any whitespace character (space, tab, line break, …)'
    )
    const quant: any = await util.apply('a*+b+?c??d{2,}e{3}f{2,4}', { format: 'json' })
    expect(quant.tree.map((n: any) => n.quantifier)).toEqual(['*+', '+?', '??', '{2,}', '{3}', '{2,4}'])
    expect(quant.tree[0].description).toBe(
      'the character "a", repeated zero or more times, possessive — never gives characters back'
    )
    expect(quant.tree[1].description).toBe(
      'the character "b", repeated one or more times, as few as possible (lazy)'
    )
    expect(quant.tree[2].description).toBe(
      'the character "c", optional (zero or one time), as few as possible (lazy)'
    )
    expect(quant.tree[3].description).toBe(
      'the character "d", repeated 2 or more times, as many as possible (greedy)'
    )
    // an exact count is neither greedy nor lazy — no "as many as possible" tail
    expect(quant.tree[4].description).toBe('the character "e", repeated exactly 3 times')
    expect(quant.tree[5].description).toBe(
      'the character "f", repeated between 2 and 4 times, as many as possible (greedy)'
    )
    const prop: any = await util.apply('\\p{Script=Greek}\\P{L}', { format: 'json' })
    expect(prop.tree[0].description).toContain('Unicode property Script=Greek')
    expect(prop.tree[1].description).toContain('WITHOUT the Unicode property L')
  })

  it('keeps astral characters whole', async () => {
    const out: any = await util.apply('😀+é', { format: 'json' })
    expect(out.tree).toHaveLength(2)
    expect(out.tree[0].token).toBe('😀+')
    expect(out.tree[0].description).toContain('the character "😀"')
    expect(out.tree[1].description).toBe('the character "é"')
    const esc: any = await util.apply('\\u{1F600}', { format: 'json' })
    expect(esc.tree[0].description).toBe('the character U+1F600 ("😀")')
  })

  it('every node reports the exact source text it came from', async () => {
    // If the parser cursor ever drifts, node.raw stops reconstructing the pattern.
    const patterns = [
      '^\\s*(\\w+)\\s*=\\s*(.*)$',
      '(?<n>\\d{4})-(?<m>\\d{2})',
      '[^\\]\\\\]+|a{2,4}?',
      '😀+é',
      'a(?=b)(?!c)(?<=d)(?<!e)f',
      '\\u{1F600}\\p{Script=Greek}\\x41\\cA'
    ]
    for (const p of patterns) {
      const out: any = await util.apply('', { pattern: p, format: 'json' })
      expect(out.tree.map((n: any) => n.raw).join('')).toBe(p)
    }
  })

  it('throws clear errors on malformed patterns and flags', () => {
    expect(() => util.apply('(abc', {})).toThrow(/no matching "\)"/)
    expect(() => util.apply('[abc', {})).toThrow(/no matching "\]"/)
    expect(() => util.apply('abc)', {})).toThrow(/unmatched "\)"/)
    expect(() => util.apply('*abc', {})).toThrow(/nothing to repeat/)
    expect(() => util.apply('a{4,2}', {})).toThrow(/maximum is below the minimum/)
    expect(() => util.apply('a\\', {})).toThrow(/dangling backslash/)
    expect(() => util.apply('abc', { flags: 'z' })).toThrow(/unknown regex flag "z"/)
    expect(() => util.apply('abc', { flags: 'gg' })).toThrow(/duplicate regex flag "g"/)
  })
})

describe('regex_explain — attacker-sized input', () => {
  // every "{" scanned ahead to the next "}" — quadratic on a pattern of unclosed braces
  it('explains a long run of unclosed braces in linear time', () => {
    const t0 = performance.now()
    util.apply('{'.repeat(80_000), {})
    expect(performance.now() - t0).toBeLessThan(2000)
  })

  it('still reads {n,m} quantifiers and treats a non-quantifier brace literally', () => {
    expect(JSON.stringify(util.apply('a{2,3}', {}))).toContain('repeated between 2 and 3 times')
    expect(JSON.stringify(util.apply('a{x}', {}))).not.toContain('repeated')
  })
})
