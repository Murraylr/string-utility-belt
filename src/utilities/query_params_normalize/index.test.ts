import { describe, it, expect } from 'vitest'
import util from './index'

describe('query_params_normalize', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('query_params_normalize')
    expect(util.name).toBe('normalize query params')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'decode',
      'dedupe',
      'drop',
      'dropEmpty',
      'lowercaseHost',
      'sort'
    ])
    // the manifest pins every default
    expect(util.params.sort.default).toBe(true)
    expect(util.params.dedupe.default).toBe('last')
    expect(util.params.dropEmpty.default).toBe(false)
    expect(util.params.drop.default).toBe('')
    expect(util.params.decode.default).toBe(false)
    expect(util.params.lowercaseHost.default).toBe(true)
  })

  it('sorts, dedupes and lowercases the host by default', async () => {
    expect(await util.apply('https://EXAMPLE.com/Path?b=2&a=1&a=3', {})).toBe('https://example.com/Path?a=3&b=2')
  })

  it('returns an empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   ', {})).toBe('')
  })

  it('works on a bare query string and keeps a leading question mark', async () => {
    expect(await util.apply('b=2&a=1', {})).toBe('a=1&b=2')
    expect(await util.apply('?b=2&a=1', {})).toBe('?a=1&b=2')
  })

  it('honours every dedupe option', async () => {
    const url = 'https://example.com/?a=1&b=9&a=2'
    expect(await util.apply(url, { dedupe: 'none', sort: false })).toBe('https://example.com/?a=1&b=9&a=2')
    expect(await util.apply(url, { dedupe: 'first', sort: false })).toBe('https://example.com/?a=1&b=9')
    expect(await util.apply(url, { dedupe: 'last', sort: false })).toBe('https://example.com/?b=9&a=2')
    // dedupe compares decoded keys, so `a` and `%61` are the same parameter
    expect(await util.apply('a=1&%61=2', { dedupe: 'last', sort: false })).toBe('%61=2')
  })

  it('leaves order alone when sort is false and sorts when true', async () => {
    expect(await util.apply('z=1&a=2', { sort: false })).toBe('z=1&a=2')
    expect(await util.apply('z=1&a=2', { sort: true })).toBe('a=2&z=1')
    // equal keys are ordered by value so the result is fully deterministic
    expect(await util.apply('a=2&b=1&a=1', { sort: true, dedupe: 'none' })).toBe('a=1&a=2&b=1')
  })

  it('drops keys by comma list and wildcard', async () => {
    expect(
      await util.apply('https://example.com/p?utm_source=x&utm_medium=y&fbclid=z&id=7', { drop: 'utm_*,fbclid' })
    ).toBe('https://example.com/p?id=7')
    // dropping everything leaves the URL without a question mark
    expect(await util.apply('https://example.com/p?utm_source=x#top', { drop: 'utm_*' })).toBe(
      'https://example.com/p#top'
    )
    // whitespace around each pattern is ignored
    expect(await util.apply('a=1&b=2', { drop: ' a , ' })).toBe('b=2')
  })

  it('treats regex metacharacters in drop patterns literally', async () => {
    // `.` must match a literal dot, not "any character", or `axb` would vanish too
    expect(await util.apply('a.b=1&axb=2&c=3', { drop: 'a.b' })).toBe('axb=2&c=3')
    expect(await util.apply('a+b=1&c=2', { drop: 'a+b' })).toBe('c=2')
  })

  it('drops empty values only when dropEmpty is on', async () => {
    expect(await util.apply('a=1&b=&c=3', { dropEmpty: false })).toBe('a=1&b=&c=3')
    expect(await util.apply('a=1&b=&c=3', { dropEmpty: true })).toBe('a=1&c=3')
  })

  it('keeps valueless keys bare instead of inventing an =', async () => {
    expect(await util.apply('https://example.com/p?b&a=1', {})).toBe('https://example.com/p?a=1&b')
    expect(await util.apply('a=1&flag&b=', { dropEmpty: true })).toBe('a=1')
  })

  it('decodes values when decode is true and preserves encoding when false', async () => {
    const url = 'https://example.com/?q=%F0%9F%98%80&s=hello+world'
    expect(await util.apply(url, { decode: false })).toBe('https://example.com/?q=%F0%9F%98%80&s=hello+world')
    const decoded = (await util.apply(url, { decode: true })) as string
    expect(decoded).toBe('https://example.com/?q=😀&s=hello world')
    // the emoji stayed a single code point
    expect(Array.from(decoded.split('q=')[1].split('&')[0])).toHaveLength(1)
    // sorting always compares decoded keys, even when the output stays encoded
    expect(await util.apply('caf%C3%A9=1&a=2', { decode: false })).toBe('a=2&caf%C3%A9=1')
  })

  it('lowercases the host but never the path or the query', async () => {
    expect(await util.apply('HTTPS://EXAMPLE.COM/CaseSensitive?B=Two', { lowercaseHost: true })).toBe(
      'https://example.com/CaseSensitive?B=Two'
    )
    expect(await util.apply('HTTPS://EXAMPLE.COM/CaseSensitive?B=Two', { lowercaseHost: false })).toBe(
      'HTTPS://EXAMPLE.COM/CaseSensitive?B=Two'
    )
    expect(await util.apply('https://User:Pw@EXAMPLE.com/x?a=1', {})).toBe('https://User:Pw@example.com/x?a=1')
    expect(await util.apply('https://[::1]:8080/A?b=2&a=1', {})).toBe('https://[::1]:8080/A?a=1&b=2')
  })

  it('never mistakes a relative path for a host', async () => {
    // `Docs` is a directory, not a hostname — its case must survive
    expect(await util.apply('Docs/Guide.html?b=2&a=1', {})).toBe('Docs/Guide.html?a=1&b=2')
    expect(await util.apply('Path/To?b=2&a=1', {})).toBe('Path/To?a=1&b=2')
    expect(await util.apply('/Path/To?b=2&a=1', {})).toBe('/Path/To?a=1&b=2')
    // …while a genuine scheme-less host still gets lowercased
    expect(await util.apply('EXAMPLE.com/Path?b=2&a=1', {})).toBe('example.com/Path?a=1&b=2')
    expect(await util.apply('LOCALHOST:3000/X?b=2&a=1', {})).toBe('localhost:3000/X?a=1&b=2')
  })

  it('keeps the fragment and matches drop patterns case-insensitively', async () => {
    expect(await util.apply('https://example.com/p?B=2&a=1#Section', {})).toBe('https://example.com/p?B=2&a=1#Section')
    expect(await util.apply('https://example.com/p?UTM_Source=x&id=1', { drop: 'utm_*' })).toBe(
      'https://example.com/p?id=1'
    )
    // a `?` inside the fragment belongs to the fragment, not to the query
    expect(await util.apply('https://EXAMPLE.com/#/route?b=2&a=1', {})).toBe('https://example.com/#/route?b=2&a=1')
  })

  it('throws on malformed percent-encoding when decoding', () => {
    expect(() => util.apply('a=%ZZ', { decode: true })).toThrow(/percent-encoding/)
    // …but leaves it alone when it is only being compared, not rewritten
    expect(util.apply('b=%ZZ&a=1', { decode: false })).toBe('a=1&b=%ZZ')
  })
})
