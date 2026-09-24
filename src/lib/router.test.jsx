import { describe, it, expect, afterEach } from 'vitest'
import { getRoute } from './router'

afterEach(() => { location.hash = '' })

describe('router', () => {
  it('defaults to home when no hash', () => {
    expect(getRoute().name).toBe('home')
  })

  it('routes home for #/', () => {
    location.hash = '#/'
    expect(getRoute().name).toBe('home')
  })

  it('routes the blog index', () => {
    location.hash = '#/blog'
    expect(getRoute().name).toBe('blogIndex')
  })

  it('routes a blog post with its slug', () => {
    location.hash = '#/blog/hello-world'
    expect(getRoute()).toEqual({ name: 'blogPost', params: { slug: 'hello-world' } })
  })

  it('keeps nested slugs intact', () => {
    location.hash = '#/blog/2025/hello'
    expect(getRoute().params.slug).toBe('2025/hello')
  })

  it('strips query strings from routes', () => {
    location.hash = '#/blog?utm=1'
    expect(getRoute().name).toBe('blogIndex')
    location.hash = '#/blog/hello?utm=1'
    expect(getRoute()).toEqual({ name: 'blogPost', params: { slug: 'hello' } })
    location.hash = '#/?x=1'
    expect(getRoute().name).toBe('home')
  })

  it('tolerates hand-typed hash variants', () => {
    location.hash = '#/blog/'
    expect(getRoute().name).toBe('blogIndex')
    location.hash = '#blog'
    expect(getRoute().name).toBe('blogIndex')
    location.hash = '#blog/hello-world'
    expect(getRoute()).toEqual({ name: 'blogPost', params: { slug: 'hello-world' } })
    location.hash = '#/blog//x'
    expect(getRoute().params.slug).toBe('x')
  })

  it('returns notFound for unknown paths', () => {
    location.hash = '#/nope'
    expect(getRoute().name).toBe('notFound')
  })
})

describe('router: roadmap routes', () => {
  afterEach(() => { location.hash = ''; history.replaceState(null, '', '/') })

  it('routes share links and embeds, keeping the payload opaque', () => {
    location.hash = '#/p/N4Ig-abc$def'
    expect(getRoute()).toEqual({ name: 'pipeline', params: { payload: 'N4Ig-abc$def' } })
    location.hash = '#/embed/XYZ'
    expect(getRoute()).toEqual({ name: 'embed', params: { payload: 'XYZ' } })
    location.hash = '#/p/'
    expect(getRoute().name).toBe('home')
  })

  it('routes the utilities index and a utility page', () => {
    location.hash = '#/utilities'
    expect(getRoute().name).toBe('utilities')
    location.hash = '#/util/base64_encode'
    expect(getRoute()).toEqual({ name: 'utility', params: { id: 'base64_encode' } })
  })

  it('routes the changelog', () => {
    location.hash = '#/changelog'
    expect(getRoute().name).toBe('changelog')
  })

  // security review: a link is untrusted input; a malformed escape must not throw
  // out of getRoute (AppShell calls it during render, so a throw blanks the app)
  it('treats a malformed percent-escape in a utility id as not found instead of throwing', () => {
    location.hash = '#/util/%E0%A4%A'
    expect(getRoute()).toEqual({ name: 'notFound', params: {} })
    location.hash = '#/util/%'
    expect(getRoute().name).toBe('notFound')
    history.replaceState(null, '', '/util/%E0%A4%A/')
    location.hash = ''
    expect(getRoute().name).toBe('notFound')
  })

  it('refuses blog slugs that climb out of /blog/ (dot segments, encoded or not)', () => {
    for (const hash of ['#/blog/../api/fetch', '#/blog/a/../../x', '#/blog/%2e%2e/x', '#/blog/.%2E/x', '#/blog/./x', '#/blog/a%2f..%2fx', '#/blog/a%5c..%5cx']) {
      location.hash = hash
      expect(getRoute(), hash).toEqual({ name: 'notFound', params: {} })
    }
    history.replaceState(null, '', '/blog/a%2f..%2fx/')
    location.hash = ''
    expect(getRoute().name).toBe('notFound')
    location.hash = '#/blog/2025/hello-world.v2'
    expect(getRoute()).toEqual({ name: 'blogPost', params: { slug: '2025/hello-world.v2' } })
  })

  it('routes pre-rendered static paths when there is no hash', () => {
    history.replaceState(null, '', '/util/sha3/')
    expect(getRoute()).toEqual({ name: 'utility', params: { id: 'sha3' } })
    history.replaceState(null, '', '/blog/hello/')
    expect(getRoute()).toEqual({ name: 'blogPost', params: { slug: 'hello' } })
    history.replaceState(null, '', '/util/sha3/#/blog')
    expect(getRoute().name).toBe('blogIndex')
    // the header's "Tool" link (#/) must reach the tool from a pre-rendered page
    history.replaceState(null, '', '/util/sha3/#/')
    expect(getRoute().name).toBe('home')
  })
})

describe('router docs route', () => {
  it('matches #/docs', () => {
    location.hash = '#/docs'
    expect(getRoute().name).toBe('docs')
    location.hash = ''
  })
})
