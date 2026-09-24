import { describe, it, expect } from 'vitest'
import util from './index'

describe('multi_replace', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('multi_replace')
    expect(util.name).toBe('multi replace')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['applyOnce', 'ignoreCase', 'regex', 'rules'])
    expect(util.params.rules.kind).toBe('keyvalue')
    expect(util.params.rules.default).toEqual([])
  })

  it('accepts the new keyvalue-pairs rules shape', async () => {
    const rules = [['colour', 'color'], ['grey', 'gray']]
    expect(await util.apply('the colour grey', { rules })).toBe('the color gray')
  })

  it('skips blank find fields in the pairs shape instead of throwing', async () => {
    const rules = [['', 'x'], ['foo', 'bar']]
    expect(await util.apply('foo', { rules })).toBe('bar')
  })

  it('supports regex pairs and ignoreCase with the pairs shape', async () => {
    expect(await util.apply('user@host', { rules: [['(\\w+)@(\\w+)', '$2:$1']], regex: true })).toBe('host:user')
    expect(await util.apply('FOO Foo foo', { rules: [['foo', 'bar']], ignoreCase: true })).toBe('bar bar bar')
  })

  it('returns the input untouched for an empty pairs list', async () => {
    expect(await util.apply('untouched', { rules: [] })).toBe('untouched')
  })

  it('applies every rule in the list', async () => {
    const rules = 'colour => color\ngrey => gray'
    expect(await util.apply('the colour grey', { rules })).toBe('the color gray')
  })

  it('accepts the tab-separated form and keeps its spacing', async () => {
    expect(await util.apply('foo', { rules: 'foo\tbar' })).toBe('bar')
    expect(await util.apply('a,b', { rules: ',\t, ' })).toBe('a, b')
  })

  it('skips comments and blank lines', async () => {
    const rules = '# nope => yes\n\n   \nfoo => bar'
    expect(await util.apply('foo # nope', { rules })).toBe('bar # nope')
  })

  it('escapes the comment marker with \\#', async () => {
    expect(await util.apply('# hash', { rules: '\\# => H' })).toBe('H hash')
    expect(await util.apply('a#b', { rules: '\\# => \\#\\#' })).toBe('a##b')
  })

  it('keeps $ in a literal replacement literal', async () => {
    expect(await util.apply('cost 5', { rules: '5 => $10' })).toBe('cost $10')
    expect(await util.apply('cost 5', { rules: '5 => $10', ignoreCase: true })).toBe('cost $10')
    expect(await util.apply('cost 5', { rules: '5 => $10', applyOnce: true })).toBe('cost $10')
    expect(await util.apply('a', { rules: 'a => $&' })).toBe('$&')
  })

  it('deletes text for a rule with no replacement', async () => {
    expect(await util.apply('aREMOVEb', { rules: 'REMOVE' })).toBe('ab')
  })

  it('supports regex rules with capture groups', async () => {
    const rules = '(\\w+)@(\\w+) => $2:$1'
    expect(await util.apply('user@host', { rules, regex: true })).toBe('host:user')
    expect(await util.apply('a1b2', { rules: '\\d => [$&]', regex: true })).toBe('a[1]b[2]')
  })

  it('honours ignoreCase for literal and regex rules', async () => {
    expect(await util.apply('FOO Foo foo', { rules: 'foo => bar', ignoreCase: true })).toBe('bar bar bar')
    expect(await util.apply('FOO foo', { rules: 'f.o => X', regex: true, ignoreCase: true })).toBe('X X')
    expect(await util.apply('FOO foo', { rules: 'foo => bar' })).toBe('FOO bar')
  })

  it('cascades by default and stops cascading with applyOnce', async () => {
    const rules = 'a => b\nb => a'
    expect(await util.apply('ab', { rules })).toBe('aa')
    expect(await util.apply('ab', { rules, applyOnce: true })).toBe('ba')
    const words = 'cat => dog\ndog => bird'
    expect(await util.apply('cat dog', { rules: words })).toBe('bird bird')
    expect(await util.apply('cat dog', { rules: words, applyOnce: true })).toBe('dog bird')
  })

  it('lets the earlier rule win at a position in applyOnce mode', async () => {
    expect(await util.apply('aaa', { rules: 'aa => X\na => Y', applyOnce: true })).toBe('XY')
  })

  it('combines regex rules with applyOnce', async () => {
    const rules = '(c)(at) => $2$1\ndog => bird'
    expect(await util.apply('cat dog', { rules, regex: true, applyOnce: true })).toBe('atc bird')
    // Cascading would re-scan "atc" and is left alone here; applyOnce must not.
    expect(await util.apply('AB', { rules: '[a-z] => x', regex: true, ignoreCase: true, applyOnce: true }))
      .toBe('xx')
  })

  it('handles astral characters as whole units', async () => {
    expect(await util.apply('hi :)', { rules: ':) => \u{1F600}' })).toBe('hi \u{1F600}')
    expect(await util.apply('\u{1F600} :)', { rules: '\u{1F600} => :)\n:) => \u{1F600}', applyOnce: true }))
      .toBe(':) \u{1F600}')
    expect(await util.apply('\u{1F600}\u{1F600}', { rules: '\u{1F600} => \u{1F642}' })).toBe('\u{1F642}\u{1F642}')
  })

  it('resolves escapes in literal rules', async () => {
    expect(await util.apply('a\nb', { rules: '\\n => |' })).toBe('a|b')
    expect(await util.apply('a', { rules: 'a => \\x20b' })).toBe(' b')
  })

  it('returns the input untouched for empty input or an empty rule list', async () => {
    expect(await util.apply('', { rules: 'a => b' })).toBe('')
    expect(await util.apply('untouched', { rules: '' })).toBe('untouched')
    expect(await util.apply('untouched', {})).toBe('untouched')
    // Empty input must never throw, even when the rule list is malformed.
    expect(await util.apply('', { rules: ' => y' })).toBe('')
  })

  it('throws on an invalid regex rule', () => {
    expect(() => util.apply('x', { rules: '( => y', regex: true })).toThrow(/invalid regex on line 1/)
  })

  it('throws on a rule with an empty find pattern', () => {
    expect(() => util.apply('x', { rules: 'ok => fine\n => y' })).toThrow(/empty find pattern/)
  })
})
