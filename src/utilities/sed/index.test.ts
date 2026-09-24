import { describe, it, expect } from 'vitest'
import util from './index'

describe('sed', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('sed')
    expect(util.name).toBe('sed script')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['perLine', 'script'])
    expect((util.params.script as { default: string }).default).toBe('s/foo/bar/g')
  })

  it('substitutes with and without the g flag', async () => {
    expect(await util.apply('foo foo bar', { script: 's/foo/bar/g' })).toBe('bar bar bar')
    expect(await util.apply('foo foo', { script: 's/foo/bar/' })).toBe('bar foo')
    expect(await util.apply('foo Foo', { script: 's/FOO/bar/gi' })).toBe('bar bar')
  })

  it('supports an occurrence number flag', async () => {
    expect(await util.apply('foo boo', { script: 's/o/0/2' })).toBe('fo0 boo')
    expect(await util.apply('foo boo', { script: 's/o/0/2g' })).toBe('fo0 b00')
    expect(await util.apply('aaa', { script: 's/a/b/10' })).toBe('aaa')
  })

  it('only prints an extra copy for the s "p" flag when something changed', async () => {
    expect(await util.apply('a', { script: 's/x/y/p' })).toBe('a')
    expect(await util.apply('aaa', { script: 's/a/b/2p' })).toBe('aba\naba')
  })

  it('translates characters with y', async () => {
    expect(await util.apply('aabbcc', { script: 'y/abc/xyz/' })).toBe('xxyyzz')
    expect(await util.apply('a\nb', { script: '/b/y/b/B/' })).toBe('a\nB')
  })

  it('ignores a trailing ; after a command', async () => {
    expect(await util.apply('a', { script: 's/a/b/;' })).toBe('b')
    expect(await util.apply('a', { script: 's/a/b/g ;' })).toBe('b')
    expect(await util.apply('a', { script: 'y/a/b/;' })).toBe('b')
    expect(await util.apply('a\nb', { script: '/b/d;' })).toBe('a')
  })

  it('deletes and prints lines by regex address', async () => {
    expect(await util.apply('# comment\nkeep\n# more', { script: '/^#/d' })).toBe('keep')
    expect(await util.apply('a\nkeep', { script: '/keep/p' })).toBe('a\nkeep\nkeep')
    expect(await util.apply('keep\ndrop', { script: '/keep/!d' })).toBe('keep')
  })

  it('supports line-number, $ and range addresses', async () => {
    expect(await util.apply('a\nb\nc', { script: '2d' })).toBe('a\nc')
    expect(await util.apply('a\nb\nc', { script: '$d' })).toBe('a\nb')
    expect(await util.apply('a\nb\nc', { script: '1,2d' })).toBe('c')
    expect(await util.apply('a\nb\nc', { script: '2,$d' })).toBe('a')
  })

  it('combines an address with a substitution', async () => {
    expect(await util.apply('ax\nbx', { script: '/^b/s/x/y/' })).toBe('ax\nby')
  })

  it('runs several commands in order and ignores # comments', async () => {
    expect(await util.apply('ab', { script: '# make it loud\ns/a/A/\ns/b/B/' })).toBe('AB')
    expect(await util.apply('a', { script: 's/a/X/p' })).toBe('X\nX')
  })

  it('expands & and \\1 backreferences and \\U case conversion', async () => {
    expect(await util.apply('hello world', { script: 's/(\\w+) (\\w+)/\\2 \\1/' })).toBe('world hello')
    expect(await util.apply('a1b22', { script: 's/\\d+/[&]/g' })).toBe('a[1]b[22]')
    expect(await util.apply('hello there', { script: 's/(\\w+)/\\U\\1/' })).toBe('HELLO there')
    expect(await util.apply('hello', { script: 's/(\\w+)/\\u\\1/' })).toBe('Hello')
    expect(await util.apply('ab cd', { script: 's/(\\w+) (\\w+)/\\U\\1\\E-\\2/' })).toBe('AB-cd')
    expect(await util.apply('HELLO', { script: 's/(\\w+)/\\l\\1/' })).toBe('hELLO')
    expect(await util.apply('hELLO', { script: 's/.*/\\L\\u&/' })).toBe('Hello')
    expect(await util.apply('a', { script: 's/a/\\&/' })).toBe('&')
  })

  it('accepts alternate and escaped delimiters', async () => {
    expect(await util.apply('/usr/bin/env', { script: 's|/usr/bin|/opt|' })).toBe('/opt/env')
    expect(await util.apply('a/b', { script: 's/a\\/b/X/' })).toBe('X')
  })

  it('uses sed empty-match rules for patterns that can match nothing', async () => {
    // Not String.replaceAll semantics: no empty match where the last match ended.
    expect(await util.apply('aaa', { script: 's/a*/-/g' })).toBe('-')
    expect(await util.apply('baa', { script: 's/a*/-/g' })).toBe('-b-')
    expect(await util.apply('abc', { script: 's/x*/-/g' })).toBe('-a-b-c-')
    expect(await util.apply('abc', { script: 's/x*/-/2g' })).toBe('a-b-c-')
    expect(await util.apply('a\u{1F600}b', { script: 's/x*/-/g' })).toBe('-a-\u{1F600}-b-')
  })

  it('handles astral characters and inserted newlines', async () => {
    expect(await util.apply('\u{1F600}\u{1F642}', { script: 'y/\u{1F600}\u{1F642}/\u{1F642}\u{1F600}/' }))
      .toBe('\u{1F642}\u{1F600}')
    expect(await util.apply('a café', { script: 's/café/tea/' })).toBe('a tea')
    expect(await util.apply('a,b', { script: 's/,/\\n/g' })).toBe('a\nb')
  })

  it('treats the whole text as one pattern space when perLine is off', async () => {
    expect(await util.apply('a\na', { script: 's/^a/X/', perLine: true })).toBe('X\nX')
    expect(await util.apply('a\na', { script: 's/^a/X/', perLine: false })).toBe('X\na')
    expect(await util.apply('a\nb', { script: '/b/d', perLine: false })).toBe('')
  })

  it('preserves a trailing newline and handles empty input or script', async () => {
    expect(await util.apply('a\n', { script: 's/a/b/' })).toBe('b\n')
    expect(await util.apply('', { script: 's/a/b/' })).toBe('')
    expect(await util.apply('untouched', { script: '' })).toBe('untouched')
    expect(await util.apply('untouched', { script: '# only a comment' })).toBe('untouched')
  })

  it('throws clear errors on malformed scripts', () => {
    expect(() => util.apply('x', { script: 'z/a/b/' })).toThrow(/unknown command "z"/)
    expect(() => util.apply('x', { script: 's/a/b' })).toThrow(/unterminated/)
    expect(() => util.apply('x', { script: 'y/ab/xyz/' })).toThrow(/same length/)
    expect(() => util.apply('x', { script: 's/(/y/' })).toThrow(/invalid regex/)
    expect(() => util.apply('x', { script: 's/a/b/q' })).toThrow(/unknown "s" flag/)
    expect(() => util.apply('x', { script: '/x/' })).toThrow(/missing command/)
    expect(() => util.apply('x', { script: '//d' })).toThrow(/empty address regex/)
  })

  it('rejects a backreference the pattern cannot supply', async () => {
    // Patterns are JavaScript regexes, so a sed BRE \( \) has no groups here and
    // \1 would otherwise expand silently to ''.
    expect(() => util.apply('one two', { script: 's/\\(one\\)/\\1/' })).toThrow(/invalid reference \\1/)
    expect(() => util.apply('ab', { script: 's/(a)/\\2/' })).toThrow(/invalid reference \\2/)
    expect(await util.apply('ab', { script: 's/(a)(b)/\\2\\1/' })).toBe('ba')
  })

  it('rejects ! without an address', () => {
    expect(() => util.apply('x', { script: '!d' })).toThrow(/needs an address/)
  })
})
