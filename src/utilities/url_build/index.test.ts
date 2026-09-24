import { describe, it, expect } from 'vitest'
import util from './index'
import parser from '../url_parse/index'

const roundTrip = async (url: string, params: any = {}) =>
  util.apply((await parser.apply(url, params)) as any, params)

describe('url_build', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('url_build')
    expect(util.name).toBe('url build')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('json')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['encode'])
    expect(util.params.encode.default).toBe(true)
  })

  it('assembles a URL from parts', async () => {
    const out = await util.apply(
      {
        protocol: 'https:',
        hostname: 'example.com',
        port: '8443',
        pathname: '/a/b',
        searchParams: { q: 'cats', page: '2' },
        hash: '#top'
      } as any,
      {}
    )
    expect(out).toBe('https://example.com:8443/a/b?q=cats&page=2#top')
  })

  it('returns an empty string for empty input', async () => {
    expect(await util.apply({} as any, {})).toBe('')
    expect(await util.apply('' as any, {})).toBe('')
    expect(await util.apply('   ' as any, {})).toBe('')
    // JSON null is `typeof 'object'` — it must be treated as empty, not crash
    expect(await util.apply('null' as any, {})).toBe('')
    expect(await util.apply(null as any, {})).toBe('')
  })

  it('accepts a JSON string as well as an object', async () => {
    const json = JSON.stringify({ protocol: 'https', host: 'example.com', pathname: '/x' })
    expect(await util.apply(json as any, {})).toBe('https://example.com/x')
  })

  it('repeats keys for array values and includes userinfo', async () => {
    const out = await util.apply(
      { protocol: 'https:', host: 'example.com', username: 'me', password: 'pw', searchParams: { a: ['1', '2'] } } as any,
      {}
    )
    expect(out).toBe('https://me:pw@example.com/?a=1&a=2')
  })

  it('renders non-string query values and falls back to search', async () => {
    expect(
      await util.apply({ protocol: 'https:', host: 'e.com', searchParams: { a: 1, b: true, c: null } } as any, {})
    ).toBe('https://e.com/?a=1&b=true&c=')
    // no searchParams object ⇒ the raw search string is used verbatim
    expect(await util.apply({ protocol: 'https:', host: 'e.com', search: '?a=1&a=2' } as any, {})).toBe(
      'https://e.com/?a=1&a=2'
    )
  })

  it('percent-encodes path segments and query values when encode is true', async () => {
    const out = await util.apply(
      { protocol: 'https:', host: 'example.com', pathSegments: ['a b', 'c/d'], searchParams: { 'q k': 'x&y' } } as any,
      { encode: true }
    )
    expect(out).toBe('https://example.com/a%20b/c%2Fd?q%20k=x%26y')
  })

  it('leaves parts untouched when encode is false', async () => {
    const out = await util.apply(
      { protocol: 'https:', host: 'example.com', pathSegments: ['a b'], searchParams: { q: 'x y' } } as any,
      { encode: false }
    )
    expect(out).toBe('https://example.com/a b?q=x y')
  })

  it('builds relative URLs and schemes without an authority', async () => {
    expect(await util.apply({ pathname: '/search', searchParams: { q: 'cats' }, hash: '#top' } as any, {})).toBe(
      '/search?q=cats#top'
    )
    expect(await util.apply({ protocol: 'mailto:', pathname: 'someone@example.com' } as any, {})).toBe(
      'mailto:someone@example.com'
    )
    expect(await util.apply({ protocol: 'file:', pathname: '/tmp/x' } as any, {})).toBe('file:///tmp/x')
    // no protocol but a host ⇒ a network-path reference
    expect(await util.apply({ host: 'example.com', pathname: '/a', searchParams: { x: '1' } } as any, {})).toBe(
      '//example.com/a?x=1'
    )
  })

  it('falls back to href when no parts are supplied', async () => {
    expect(await util.apply({ href: 'https://example.com/only' } as any, {})).toBe('https://example.com/only')
  })

  it('round-trips url_parse output exactly, including unicode', async () => {
    const url = 'https://user:pw@example.com:8080/a/b?x=1&x=2&y=3#frag'
    expect(await roundTrip(url)).toBe(url)
    const unicode = 'https://example.com/caf%C3%A9?q=%F0%9F%98%80'
    expect(await roundTrip(unicode)).toBe(unicode)
    expect(await roundTrip(unicode, { decodeParams: false, encode: false })).toBe(unicode)
    expect(await roundTrip('/search/results?q=cats#top')).toBe('/search/results?q=cats#top')
  })

  it('round-trips the awkward shapes too', async () => {
    // a trailing slash is meaningful and must not be eaten by pathSegments
    expect(await roundTrip('https://example.com/a/b/')).toBe('https://example.com/a/b/')
    // opaque schemes have no authority and no origin to rebuild from
    expect(await roundTrip('mailto:someone@example.com')).toBe('mailto:someone@example.com')
    expect(await roundTrip('file:///tmp/x')).toBe('file:///tmp/x')
    // scheme-less authority survives as a scheme-less authority
    expect(await roundTrip('//example.com/a?x=1')).toBe('//example.com/a?x=1')
    // an IDN host is punycoded by the parser and must stay that way
    expect(await roundTrip('https://ünicode.example/café?q=ü')).toBe(
      'https://xn--nicode-2ya.example/caf%C3%A9?q=%C3%BC'
    )
  })

  it('throws on input that is not a URL parts object', () => {
    expect(() => util.apply('not json at all' as any, {})).toThrow(/JSON object/)
    expect(() => util.apply([1, 2] as any, {})).toThrow(/not an array/)
    expect(() => util.apply('false' as any, {})).toThrow(/JSON object/)
    expect(() => util.apply('42' as any, {})).toThrow(/JSON object/)
  })

  it('throws when an http URL has no host', () => {
    expect(() => util.apply({ protocol: 'https:', pathname: '/a' } as any, {})).toThrow(/need a host/)
    expect(() => util.apply({ protocol: 'ws:', pathname: '/a' } as any, {})).toThrow(/need a host/)
  })
})
