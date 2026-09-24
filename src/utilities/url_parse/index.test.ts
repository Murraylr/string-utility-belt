import { describe, it, expect } from 'vitest'
import util from './index'

/** Every field the manifest promises, in the documented order. */
const FIELDS = [
  'href',
  'protocol',
  'username',
  'password',
  'host',
  'hostname',
  'port',
  'pathname',
  'pathSegments',
  'search',
  'searchParams',
  'hash',
  'origin',
  'isAbsolute'
]

describe('url_parse', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('url_parse')
    expect(util.name).toBe('url parse')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
    expect(Object.keys(util.params).sort()).toEqual(['base', 'decodeParams'])
    expect(util.params.base.default).toBe('')
    expect(util.params.decodeParams.default).toBe(true)
  })

  it('splits a full URL into every part', async () => {
    const out: any = await util.apply('https://user:pw@Example.com:8080/a/b?x=1#frag', {})
    expect(out.href).toBe('https://user:pw@example.com:8080/a/b?x=1#frag')
    expect(out.protocol).toBe('https:')
    expect(out.username).toBe('user')
    expect(out.password).toBe('pw')
    expect(out.host).toBe('example.com:8080')
    expect(out.hostname).toBe('example.com')
    expect(out.port).toBe('8080')
    expect(out.pathname).toBe('/a/b')
    expect(out.pathSegments).toEqual(['a', 'b'])
    expect(out.search).toBe('?x=1')
    expect(out.hash).toBe('#frag')
    expect(out.origin).toBe('https://example.com:8080')
    expect(out.isAbsolute).toBe(true)
  })

  it('emits a plain object carrying every documented field', async () => {
    const out = await util.apply('https://example.com/', {})
    expect(typeof out).toBe('object')
    expect(Array.isArray(out)).toBe(false)
    expect(Object.keys(out as object)).toEqual(FIELDS)
    // the relative branch must expose the same shape, never a subset
    expect(Object.keys((await util.apply('a/b', {})) as object)).toEqual(FIELDS)
  })

  it('returns an empty object for empty input', async () => {
    expect(await util.apply('', {})).toEqual({})
    expect(await util.apply('   ', {})).toEqual({})
  })

  it('folds repeated query keys into arrays and handles bare keys', async () => {
    const out: any = await util.apply('https://example.com/?a=1&a=2&b=3&flag', {})
    expect(out.searchParams).toEqual({ a: ['1', '2'], b: '3', flag: '' })
    // three occurrences must grow the array, not overwrite it
    const three: any = await util.apply('https://example.com/?a=1&a=2&a=3', {})
    expect(three.searchParams.a).toEqual(['1', '2', '3'])
  })

  it('captures a __proto__ query key as data instead of touching the prototype', async () => {
    const out: any = await util.apply('https://example.com/?__proto__=x&a=1', {})
    const sp = out.searchParams
    expect(Object.getOwnPropertyDescriptor(sp, '__proto__')?.value).toBe('x')
    expect(Object.getPrototypeOf(sp)).toBe(Object.prototype)
    expect(sp.a).toBe('1')
  })

  it('decodes percent-encoded params and path segments when decodeParams is true', async () => {
    const out: any = await util.apply('https://example.com/caf%C3%A9/%F0%9F%98%80?q=%F0%9F%98%80&s=hello+world', {
      decodeParams: true
    })
    expect(out.pathSegments).toEqual(['café', '😀'])
    expect(out.searchParams).toEqual({ q: '😀', s: 'hello world' })
    // the astral character survives intact, not as broken surrogate halves
    expect(Array.from(out.searchParams.q as string)).toHaveLength(1)
  })

  it('keeps raw percent-encoding when decodeParams is false', async () => {
    const out: any = await util.apply('https://example.com/caf%C3%A9?q=%F0%9F%98%80&s=hello+world', {
      decodeParams: false
    })
    expect(out.pathSegments).toEqual(['caf%C3%A9'])
    expect(out.searchParams).toEqual({ q: '%F0%9F%98%80', s: 'hello+world' })
  })

  it('keeps broken percent-escapes verbatim rather than failing the whole parse', async () => {
    // `https://example.com/?q=100%` is a URL browsers accept; one bad escape
    // must not cost the user every other field.
    const out: any = await util.apply('https://example.com/%ZZ?q=%ZZ', {})
    expect(out.searchParams).toEqual({ q: '%ZZ' })
    expect(out.pathSegments).toEqual(['%ZZ'])
    expect(out.hostname).toBe('example.com')
  })

  it('reports no origin for schemes whose origin is opaque', async () => {
    // URL#origin serialises an opaque origin as the string "null" — reporting
    // that verbatim would name a host called "null".
    for (const url of ['mailto:someone@example.com', 'file:///tmp/x', 'data:text/plain,hi']) {
      expect(((await util.apply(url, {})) as any).origin).toBe('')
    }
    // …but a genuine host called `null` keeps its origin
    expect(((await util.apply('https://null/a', {})) as any).origin).toBe('https://null')
  })

  it('resolves a relative URL against the base param', async () => {
    const out: any = await util.apply('../images/logo.png?v=2', { base: 'https://example.com/docs/guide/' })
    expect(out.href).toBe('https://example.com/docs/images/logo.png?v=2')
    expect(out.hostname).toBe('example.com')
    expect(out.pathSegments).toEqual(['docs', 'images', 'logo.png'])
    expect(out.isAbsolute).toBe(false)
  })

  it('still parses a relative reference with no base', async () => {
    const out: any = await util.apply('/search/results?q=cats&page=2#top', {})
    expect(out.isAbsolute).toBe(false)
    expect(out.protocol).toBe('')
    expect(out.host).toBe('')
    expect(out.origin).toBe('')
    expect(out.pathname).toBe('/search/results')
    expect(out.pathSegments).toEqual(['search', 'results'])
    expect(out.searchParams).toEqual({ q: 'cats', page: '2' })
    expect(out.hash).toBe('#top')
  })

  it('treats //host/path as an authority, not as path segments', async () => {
    const out: any = await util.apply('//User:pw@EXAMPLE.com:8443/a/b?x=1#f', {})
    expect(out.protocol).toBe('')
    expect(out.host).toBe('example.com:8443')
    expect(out.hostname).toBe('example.com')
    expect(out.port).toBe('8443')
    expect(out.username).toBe('User')
    expect(out.pathname).toBe('/a/b')
    expect(out.pathSegments).toEqual(['a', 'b'])
    expect(out.searchParams).toEqual({ x: '1' })
    expect(out.hash).toBe('#f')
    expect(out.origin).toBe('')
    expect(out.isAbsolute).toBe(false)
    // a base supplies the missing scheme, per RFC 3986
    const based: any = await util.apply('//other.example/a', { base: 'https://example.com/x' })
    expect(based.href).toBe('https://other.example/a')
    // `///a/b` is an empty authority — the host must not swallow `a`
    const empty: any = await util.apply('///a/b', {})
    expect(empty.host).toBe('')
    expect(empty.pathname).toBe('///a/b')
  })

  it('parses schemes without an authority', async () => {
    const out: any = await util.apply('mailto:someone@example.com', {})
    expect(out.protocol).toBe('mailto:')
    expect(out.host).toBe('')
    expect(out.pathname).toBe('someone@example.com')
    expect(out.isAbsolute).toBe(true)
  })

  it('throws on a malformed absolute URL', () => {
    expect(() => util.apply('http://', {})).toThrow(/invalid URL/)
    expect(() => util.apply('https://exa mple.com', {})).toThrow(/invalid URL/)
  })

  it('throws when the base itself is unusable', () => {
    expect(() => util.apply('/a', { base: 'not a url' })).toThrow(/invalid URL/)
  })
})
