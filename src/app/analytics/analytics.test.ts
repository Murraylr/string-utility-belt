import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { PipelineStep } from '@/types/utility'
import {
  MEASUREMENT_ID, RUN_SETTLE_MS, __resetAnalyticsForTests, analyticsEnabled, automationSignal, campaignQuery,
  canonicalPath, contentGroup, errorDescription, initAnalytics, pipelineSignature, referrerOf, searchTerm, sizeBucket, track,
  trackPipelineEvent, trackUtilityAdd, usePipelineRunTracking, useSearchTracking,
} from './analytics'

const CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const u = (utilityId: string, enabled = true): PipelineStep => ({ id: `s-${utilityId}`, utilityId, enabled })

describe('automationSignal', () => {
  it('trusts an ordinary browser', () => {
    expect(automationSignal({ userAgent: CHROME, webdriver: false })).toBeNull()
  })

  it('flags webdriver, headless and bot user agents', () => {
    expect(automationSignal({ userAgent: CHROME, webdriver: true })).toBe('webdriver')
    expect(automationSignal({ userAgent: CHROME.replace('Chrome/', 'HeadlessChrome/') })).toBe('headless')
    expect(automationSignal({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' })).toBe('bot_ua')
    expect(automationSignal({ userAgent: 'Mozilla/5.0 (compatible; AhrefsBot/7.0)' })).toBe('bot_ua')
    expect(automationSignal({ userAgent: `${CHROME} Chrome-Lighthouse` })).toBe('bot_ua')
  })

  it('does not mistake the CUBOT phone brand for a bot', () => {
    expect(automationSignal({ userAgent: 'Mozilla/5.0 (Linux; Android 11; CUBOT X30) AppleWebKit/537.36 Chrome/120 Mobile' })).toBeNull()
  })
})

describe('canonicalPath / contentGroup', () => {
  it('never reports a share payload', () => {
    expect(canonicalPath({ name: 'pipeline', params: { payload: 'N4IgSECRET' } }, '/')).toBe('/p/')
    expect(canonicalPath({ name: 'embed', params: { payload: 'N4IgSECRET' } }, '/')).toBe('/embed/')
    expect(contentGroup({ name: 'pipeline', params: {} })).toBe('shared_pipeline')
  })

  it('maps hash routes onto the real paths', () => {
    expect(canonicalPath({ name: 'utility', params: { id: 'base64_encode' } }, '/')).toBe('/util/base64_encode/')
    expect(canonicalPath({ name: 'utilities', params: {} }, '/')).toBe('/utilities/')
    expect(canonicalPath({ name: 'blogPost', params: { slug: 'md5' } }, '/blog/md5/')).toBe('/blog/md5/')
    expect(canonicalPath({ name: 'page', params: { slug: 'privacy' } }, '/privacy/')).toBe('/privacy/')
    expect(contentGroup({ name: 'utility', params: { id: 'x' } })).toBe('utility_docs')
  })

  it('reports preset pages by their pre-rendered paths, in their own content groups', () => {
    expect(canonicalPath({ name: 'presets', params: {} }, '/')).toBe('/presets/')
    expect(canonicalPath({ name: 'preset', params: { slug: 'decode-saml-request' } }, '/')).toBe('/presets/decode-saml-request/')
    expect(contentGroup({ name: 'presets', params: {} })).toBe('preset_index')
    expect(contentGroup({ name: 'preset', params: { slug: 'x' } })).toBe('preset')
  })

  it('reports an unknown path as-is, and an unknown hash route as /404/', () => {
    expect(canonicalPath({ name: 'notFound', params: {} }, '/wp-admin/')).toBe('/wp-admin/')
    expect(canonicalPath({ name: 'notFound', params: {} }, '/')).toBe('/404/')
  })
})

describe('referrerOf', () => {
  const origin = 'https://stringutilitybelt.com'

  it('keeps another site’s referrer and strips the query from this site’s own', () => {
    expect(referrerOf('https://www.google.com/', origin)).toBe('https://www.google.com/')
    expect(referrerOf(`${origin}/?text=my+secret`, origin)).toBe(`${origin}/`)
    expect(referrerOf(`${origin}/util/md5/?q=x`, origin)).toBe(`${origin}/util/md5/`)
    expect(referrerOf('', origin)).toBeUndefined()
    expect(referrerOf('not a url', origin)).toBeUndefined()
  })
})

describe('campaignQuery', () => {
  it('keeps campaign parameters only', () => {
    expect(campaignQuery('?utm_source=hn&text=my+secret&utm_medium=social&url=https%3A%2F%2Fx'))
      .toBe('?utm_source=hn&utm_medium=social')
    expect(campaignQuery('?text=secret')).toBe('')
    expect(campaignQuery('')).toBe('')
  })
})

describe('pipelineSignature', () => {
  it('lists enabled utilities in order, branches in brackets and macros in parentheses', () => {
    const steps: PipelineStep[] = [
      u('base64_decode'),
      u('trim', false),
      { id: 'b', type: 'branch', branches: [[u('md5')], [u('sha256'), u('upper')]], merge: { mode: 'concat' } } as PipelineStep,
      { id: 'm', type: 'macro', name: 'mine', steps: [u('json_format')] } as PipelineStep,
    ]
    expect(pipelineSignature(steps)).toBe('base64_decode>[md5|sha256>upper]>(json_format)')
  })

  it('shows "run on each" steps in braces with their split mode, never the delimiter text the user typed', () => {
    const steps: PipelineStep[] = [
      { id: 'e', type: 'each', split: { mode: 'delimiter', separator: 'secret-token' }, steps: [u('base64_decode'), u('trim', false)] } as PipelineStep,
      { id: 'j', type: 'each', split: { mode: 'json-values' }, steps: [{ id: 'm', type: 'macro', name: 'm', steps: [u('upper')] } as PipelineStep] } as PipelineStep,
    ]
    const sig = pipelineSignature(steps)
    expect(sig).toBe('{delimiter:base64_decode}>{json-values:(upper)}')
    expect(sig).not.toContain('secret')
  })

  it('fits GA’s 100-character limit', () => {
    const long = Array.from({ length: 30 }, (_, i) => u(`utility_${i}`))
    const sig = pipelineSignature(long)
    expect(sig).toHaveLength(100)
    expect(sig.endsWith('…')).toBe(true)
  })
})

describe('sizeBucket', () => {
  it('buckets sizes', () => {
    expect([-1, 0, 5, 100, 999, 1000, 50_000, 999_999, 1_000_000].map(sizeBucket))
      .toEqual(['n/a', '0', '<100', '100-999', '100-999', '1K-10K', '10K-100K', '100K-1M', '1M+'])
  })
})

describe('searchTerm', () => {
  it('normalizes queries and ignores one-letter ones', () => {
    expect(searchTerm('  Base64   Decode ')).toBe('base64 decode')
    expect(searchTerm('b')).toBeNull()
  })

  it('redacts what looks like pasted data', () => {
    for (const q of ['me@example.com', 'https://example.com/x', 'order 1234567', 'eyJhbGciOiJIUzI1NiIsInR5cCI6', 'x'.repeat(41)]) {
      expect(searchTerm(q)).toBe('(redacted)')
    }
  })
})

describe('errorDescription', () => {
  it('blanks quoted fragments, which often hold input', () => {
    expect(errorDescription('SyntaxError', 'Unexpected token \'s\', "secret text" is not valid JSON'))
      .toBe('SyntaxError: Unexpected token \'…\', "…" is not valid JSON')
  })
})

describe('initAnalytics', () => {
  let gtag: ReturnType<typeof vi.fn>
  const hosts = [location.hostname]
  const calls = () => gtag.mock.calls as unknown[][]
  const events = (name?: string) => calls().filter(c => c[0] === 'event' && (!name || c[1] === name))
  const everything = () => JSON.stringify(calls())

  beforeEach(() => {
    vi.useFakeTimers()
    gtag = vi.fn()
    ;(window as unknown as { gtag: unknown }).gtag = gtag
    Object.defineProperty(window.screen, 'width', { value: 1920, configurable: true })
    Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true })
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
    localStorage.clear()
    sessionStorage.clear()
    history.replaceState(null, '', '/')
    document.title = 'String Utility Belt'
  })

  afterEach(() => {
    __resetAnalyticsForTests()
    delete (window as unknown as { gtag?: unknown }).gtag
    vi.useRealTimers()
  })

  it('stays silent without gtag, off the production hosts, or when opted out', () => {
    delete (window as unknown as { gtag?: unknown }).gtag
    initAnalytics({ hosts })
    expect(analyticsEnabled()).toBe(false)

    ;(window as unknown as { gtag: unknown }).gtag = gtag
    initAnalytics({ hosts: ['stringutilitybelt.com'] })
    expect(analyticsEnabled()).toBe(false)

    history.replaceState(null, '', '/?analytics=off')
    initAnalytics({ hosts })
    expect(analyticsEnabled()).toBe(false)
    expect(location.search).toBe('') // the switch leaves the address bar
    expect(localStorage.getItem('sub:pref:analytics')).toBe('"off"')
    track('output_copy')
    expect(gtag).not.toHaveBeenCalled()
  })

  it('configures the tag without an automatic page view, after the sanitized page fields', () => {
    initAnalytics({ hosts })
    const setIdx = calls().findIndex(c => c[0] === 'set' && (c[1] as Record<string, unknown>).page_location)
    const configIdx = calls().findIndex(c => c[0] === 'config')
    expect(setIdx).toBeGreaterThanOrEqual(0)
    expect(setIdx).toBeLessThan(configIdx)
    expect(calls()[configIdx]).toEqual(['config', MEASUREMENT_ID, { send_page_view: false }])
    expect(calls()).toContainEqual(['set', 'user_properties', { visitor_type: 'unverified', display_mode: 'browser', theme: 'system' }])
  })

  it('reports a share link as /p/ and never sends its payload or query text', () => {
    history.replaceState(null, '', '/?text=my+secret+input&utm_source=newsletter#/p/N4IgSECRETPAYLOAD')
    initAnalytics({ hosts })
    vi.advanceTimersByTime(3000)
    const [view] = events('page_view')
    expect(view[2]).toMatchObject({
      page_location: `${location.origin}/p/?utm_source=newsletter`,
      content_group: 'shared_pipeline',
      page_title: 'String Utility Belt',
    })
    expect(everything()).not.toContain('SECRET')
    expect(everything()).not.toContain('my+secret')
  })

  it('waits for the page title, then reports each navigation once with the previous page as referrer', () => {
    initAnalytics({ hosts })
    vi.advanceTimersByTime(3000)
    history.pushState(null, '', '/util/base64_encode/')
    window.dispatchEvent(new PopStateEvent('popstate'))
    document.title = 'Base64 Encode Online'
    window.dispatchEvent(new PopStateEvent('popstate')) // same page again: not a new view
    vi.advanceTimersByTime(3000)
    const views = events('page_view')
    expect(views).toHaveLength(2)
    expect(views[1][2]).toMatchObject({
      page_location: `${location.origin}/util/base64_encode/`,
      page_referrer: `${location.origin}/`,
      page_title: 'Base64 Encode Online',
      utility_id: 'base64_encode',
      content_group: 'utility_docs',
    })
  })

  it('sends a pending page view when the page is hidden', () => {
    initAnalytics({ hosts })
    expect(events('page_view')).toHaveLength(0)
    window.dispatchEvent(new Event('pagehide'))
    expect(events('page_view')).toHaveLength(1)
  })

  it('labels announced automation and reports nothing but its page views', () => {
    Object.defineProperty(navigator, 'webdriver', { value: true, configurable: true })
    initAnalytics({ hosts })
    vi.advanceTimersByTime(3000)
    expect(calls()).toContainEqual(['set', 'user_properties', expect.objectContaining({ visitor_type: 'automated' })])
    expect(events('page_view')[0][2]).toMatchObject({ automation_signal: 'webdriver' })
    track('output_copy')
    trackUtilityAdd('base64_encode', 'picker')
    expect(events()).toHaveLength(1)
  })

  it('does not count a 0×0 screen as automation (background tabs and webviews report one)', () => {
    Object.defineProperty(window.screen, 'width', { value: 0, configurable: true })
    Object.defineProperty(window.screen, 'height', { value: 0, configurable: true })
    initAnalytics({ hosts })
    expect(calls()).toContainEqual(['set', 'user_properties', expect.objectContaining({ visitor_type: 'unverified' })])
  })

  it('remembers a human visitor across visits', () => {
    localStorage.setItem('sub:analytics:human', '1')
    initAnalytics({ hosts })
    expect(calls()).toContainEqual(['set', 'user_properties', expect.objectContaining({ visitor_type: 'human' })])
  })

  it('ignores synthetic input events: only a trusted one marks a human', () => {
    initAnalytics({ hosts })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    window.dispatchEvent(new Event('pointerdown'))
    expect(events('human_interaction')).toHaveLength(0)
    expect(localStorage.getItem('sub:analytics:human')).toBeNull()
  })

  it('reports uncaught errors with quoted text blanked, at most five per page', () => {
    initAnalytics({ hosts })
    for (let i = 0; i < 7; i++) {
      window.dispatchEvent(new ErrorEvent('error', { error: new TypeError(`cannot read "secret ${i}"`), message: 'x' }))
    }
    window.dispatchEvent(new ErrorEvent('error', { message: 'Script error.' }))
    const errors = events('exception')
    expect(errors).toHaveLength(5)
    expect(errors[0][2]).toEqual({ description: 'TypeError: cannot read "…"', fatal: false })
  })

  it('adds the utility category and the pipeline shape to feature events', () => {
    initAnalytics({ hosts })
    trackUtilityAdd('base64_encode', 'picker')
    trackPipelineEvent('output_copy', [u('base64_encode'), u('md5')], { format: 'raw' })
    expect(events('utility_add')[0][2]).toEqual({ utility_id: 'base64_encode', utility_category: 'Encoding', method: 'picker' })
    expect(events('output_copy')[0][2]).toEqual({ pipeline: 'base64_encode>md5', step_count: 2, format: 'raw' })
  })
})

describe('usePipelineRunTracking', () => {
  let gtag: ReturnType<typeof vi.fn>
  const runs = () => (gtag.mock.calls as unknown[][]).filter(c => c[0] === 'event')

  beforeEach(() => {
    vi.useFakeTimers()
    gtag = vi.fn()
    ;(window as unknown as { gtag: unknown }).gtag = gtag
    Object.defineProperty(window.screen, 'width', { value: 1920, configurable: true })
    Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true })
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
    history.replaceState(null, '', '/')
    localStorage.clear()
    initAnalytics({ hosts: [location.hostname] })
    vi.advanceTimersByTime(3000)
    gtag.mockClear()
  })

  afterEach(() => {
    __resetAnalyticsForTests()
    delete (window as unknown as { gtag?: unknown }).gtag
    vi.useRealTimers()
  })

  type Props = { steps: PipelineStep[]; input: string; result: { out?: string; err: Record<string, string>; where?: string } | null }
  const render = (initial: Props) => renderHook(
    (p: Props) => usePipelineRunTracking(p.steps, p.input, p.result, 12.4), { initialProps: initial })

  it('does not count a restored pipeline re-running on load', () => {
    render({ steps: [u('upper')], input: 'hello', result: { out: 'HELLO', err: {} } })
    act(() => { vi.advanceTimersByTime(RUN_SETTLE_MS * 2) })
    expect(runs()).toHaveLength(0)
  })

  it('skips a run with nothing in and nothing out, but counts a generator', () => {
    const hook = render({ steps: [u('upper')], input: 'x', result: null })
    hook.rerender({ steps: [u('upper'), u('trim')], input: '', result: { out: '', err: {} } })
    act(() => { vi.advanceTimersByTime(RUN_SETTLE_MS) })
    expect(runs()).toHaveLength(0)
    hook.rerender({ steps: [u('uuid')], input: '', result: { out: '1b4e28ba-2fa1-11d2-883f-0016d3cca427', err: {} } })
    act(() => { vi.advanceTimersByTime(RUN_SETTLE_MS) })
    expect(runs().map(c => c[2])).toEqual([expect.objectContaining({ pipeline: 'uuid', input_size: '0' })])
  })

  it('counts a settled run once per distinct pipeline, with step errors once per utility', () => {
    const steps = [u('upper')]
    const hook = render({ steps, input: '', result: null })
    hook.rerender({ steps, input: 'h', result: { err: {} } })
    hook.rerender({ steps, input: 'hi', result: { err: {}, where: 'worker' } }) // typing: only the settled run counts
    act(() => { vi.advanceTimersByTime(RUN_SETTLE_MS) })
    const failing = [u('upper'), u('json_format')]
    hook.rerender({ steps: failing, input: 'hi', result: { err: { 's-json_format': 'Unexpected token' } } })
    act(() => { vi.advanceTimersByTime(RUN_SETTLE_MS) })
    hook.rerender({ steps: failing, input: 'hi!', result: { err: { 's-json_format': 'Unexpected token' } } })
    act(() => { vi.advanceTimersByTime(RUN_SETTLE_MS) })

    expect(runs().map(c => c[1])).toEqual(['pipeline_run', 'step_error', 'pipeline_run'])
    expect(runs()[0][2]).toEqual({
      pipeline: 'upper', step_count: 1, input_type: 'text', input_size: '<100', run_where: 'worker', run_ms: 12,
    })
    expect(runs()[1][2]).toMatchObject({ utility_id: 'json_format' })
    expect(JSON.stringify(runs())).not.toContain('Unexpected token')
  })
})

describe('useSearchTracking', () => {
  let gtag: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    gtag = vi.fn()
    ;(window as unknown as { gtag: unknown }).gtag = gtag
    Object.defineProperty(navigator, 'webdriver', { value: false, configurable: true })
    Object.defineProperty(window.screen, 'width', { value: 1920, configurable: true })
    Object.defineProperty(window.screen, 'height', { value: 1080, configurable: true })
    history.replaceState(null, '', '/')
    initAnalytics({ hosts: [location.hostname] })
    gtag.mockClear()
  })

  afterEach(() => {
    __resetAnalyticsForTests()
    delete (window as unknown as { gtag?: unknown }).gtag
    vi.useRealTimers()
  })

  it('reports a query once it settles, with its result count', () => {
    const hook = renderHook((p: { q: string; n: number }) => useSearchTracking('picker', p.q, p.n), { initialProps: { q: 'b', n: 40 } })
    hook.rerender({ q: 'bas', n: 9 })
    hook.rerender({ q: 'base65', n: 0 })
    act(() => { vi.advanceTimersByTime(2000) })
    hook.rerender({ q: 'base65 ', n: 0 }) // same term after normalizing
    act(() => { vi.advanceTimersByTime(2000) })
    const searches = (gtag.mock.calls as unknown[][]).filter(c => c[1] === 'search')
    expect(searches).toEqual([['event', 'search', { search_term: 'base65', search_location: 'picker', results_count: 0 }]])
  })
})
