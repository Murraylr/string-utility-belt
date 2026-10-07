/**
 * Google Analytics 4. index.html loads gtag.js and sets the Consent Mode defaults;
 * this module configures the tag and is the only code that reports anything, so what
 * leaves the browser is decided here:
 *
 * - Only the production site reports. Local dev, `vite preview`, E2E/CI runs and
 *   preview deployments stay silent, and so does a browser opened once with
 *   `?analytics=off` (remembered; `?analytics=on` undoes it, `?analytics=debug` reports
 *   from any host to GA's DebugView — the property's developer-traffic filter keeps
 *   those events out of the reports).
 * - Page views carry a canonical URL built from the route, never `location.href`: a
 *   share link's fragment (`#/p/<payload>`) can hold the user's input and a query string
 *   can hold PWA share-target text. Only campaign parameters survive, on the landing page.
 * - Events say what was done — utility ids, formats, counts, size buckets — never the
 *   text or files being worked on.
 * - Browsers that announce automation (webdriver, headless or bot user agents) are
 *   reported as `visitor_type: automated`, with page views only. The first real
 *   pointer/key/touch/wheel input marks a visitor `human`; everyone else is `unverified`.
 */
import { useEffect, useRef } from 'react'
import { getRoute, onRouteChange, type Route } from '@/lib/router'
import { readPref, writePref } from '@/app/prefs'
import { registry } from '@/app/registry'
import { isBytes, isEmptyValue } from '@/core/coerce'
import { countSteps, findStep, isBranchStep, isEachStep, isMacroStep, isUtilityStep } from '@/core/steps'
import type { PipelineStep, Value } from '@/types/utility'

export const MEASUREMENT_ID = 'G-EFVMEMB86E'
export const PRODUCTION_HOSTS: readonly string[] = ['stringutilitybelt.com', 'www.stringutilitybelt.com']

export type Params = Record<string, string | number | boolean | undefined>
export type AnalyticsMode = 'on' | 'off' | 'debug'
type Gtag = (...args: unknown[]) => void

/** GA4 standard properties keep 100 characters of a parameter value. */
const MAX_VALUE = 100
const CAMPAIGN_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'gclid', 'gbraid', 'wbraid', 'dclid']
const HUMAN_INPUTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const
const HUMAN_KEY = 'sub:analytics:human'
const HUMAN_SESSION_KEY = 'sub:analytics:human-session'
/** A page view waits for the page's title: quiet this long, or at most MAX. */
const TITLE_QUIET_MS = 400
const TITLE_MAX_MS = 2500
/** A pipeline counts as run once its result has stood this long (not per keystroke). */
export const RUN_SETTLE_MS = 2000
const SEARCH_SETTLE_MS = 1500
const MAX_EXCEPTIONS = 5

// --- pure helpers (exported for tests) -------------------------------------------

export const clip = (s: string): string => (s.length > MAX_VALUE ? `${s.slice(0, MAX_VALUE - 1)}…` : s)

/**
 * Why this browser is automation, from what it says about itself; null when it doesn't.
 * Only self-declared signals: a 0×0 screen looks headless but is also what a real browser
 * reports for a page loaded in a background tab or webview.
 */
export function automationSignal(nav: { userAgent?: string; webdriver?: boolean }): string | null {
  if (nav.webdriver) return 'webdriver'
  const ua = nav.userAgent ?? ''
  if (/headless|phantomjs|slimerjs/i.test(ua)) return 'headless'
  if (/lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|google-inspectiontool|bingpreview|facebookexternalhit/i.test(ua)) return 'bot_ua'
  // "Googlebot/2.1", "AhrefsBot/7.0"… but not the CUBOT phone brand
  if (/(?:bot|crawler|spider|slurp)(?:[\s/;),]|$)/i.test(ua) && !/cubot/i.test(ua)) return 'bot_ua'
  return null
}

/** The path a route is reported under. Share payloads never leave; unknown paths do (404 report). */
export function canonicalPath(route: Route, pathname: string): string {
  switch (route.name) {
    case 'home': return '/'
    case 'pipeline': return '/p/'
    case 'embed': return '/embed/'
    case 'docs': return '/docs/'
    case 'blogIndex': return '/blog/'
    case 'blogPost': return `/blog/${route.params.slug}/`
    case 'utilities': return '/utilities/'
    case 'utility': return `/util/${encodeURIComponent(route.params.id)}/`
    case 'recipes': return '/recipes/'
    case 'recipe': return `/recipes/${encodeURIComponent(route.params.slug)}/`
    case 'changelog': return '/changelog/'
    case 'page': return `/${route.params.slug}/`
    case 'notFound': return pathname && pathname !== '/' ? clip(pathname) : '/404/'
  }
}

export function contentGroup(route: Route): string {
  switch (route.name) {
    case 'home': return 'tool'
    case 'pipeline': return 'shared_pipeline'
    case 'embed': return 'embed'
    case 'docs': return 'docs'
    case 'blogIndex': case 'blogPost': return 'blog'
    case 'utilities': return 'utility_index'
    case 'utility': return 'utility_docs'
    case 'recipes': return 'recipe_index'
    case 'recipe': return 'recipe'
    case 'changelog': return 'changelog'
    case 'page': return 'site_page'
    case 'notFound': return 'not_found'
  }
}

/**
 * The referrer as reported. Another site's is kept (it is where the visit came from); one
 * of this site's own pages — after a reload or a full-page link — loses its query string,
 * which can hold PWA share-target text. Browsers never include the fragment.
 */
export function referrerOf(referrer: string, origin: string): string | undefined {
  if (!referrer) return undefined
  try {
    const url = new URL(referrer)
    return url.origin === origin ? `${url.origin}${url.pathname}` : referrer
  } catch {
    return undefined
  }
}

/** Only the campaign parameters of a query string (`?utm_source=…`), or ''. */
export function campaignQuery(search: string): string {
  const all = new URLSearchParams(search)
  const kept = new URLSearchParams()
  for (const key of CAMPAIGN_PARAMS) {
    const v = all.get(key)
    if (v) kept.set(key, v.slice(0, MAX_VALUE))
  }
  const q = kept.toString()
  return q ? `?${q}` : ''
}

/**
 * The enabled steps as `a>b>[c|d]>(e)>{lines:f}` — branches in brackets, macros in
 * parentheses, "run on each" steps in braces with their split mode. Ids and modes only:
 * never a delimiter, which is text the user typed.
 */
export function pipelineSignature(steps: PipelineStep[]): string {
  const sig = (seq: PipelineStep[]): string => seq
    .filter(s => s.enabled !== false)
    .map(s => (isUtilityStep(s) ? s.utilityId
      : isBranchStep(s) ? `[${s.branches.map(sig).join('|')}]`
        : isMacroStep(s) ? `(${sig(s.steps)})`
          : isEachStep(s) ? `{${s.split.mode}:${sig(s.steps)}}` : '?'))
    .join('>')
  return clip(sig(steps))
}

/** Characters (text) or bytes; -1 for a JSON value (measuring it would mean serializing it). */
export function valueSize(v: Value): number {
  if (typeof v === 'string') return v.length
  if (isBytes(v)) return v.length
  return -1
}

export function sizeBucket(n: number): string {
  if (n < 0) return 'n/a'
  if (n === 0) return '0'
  if (n < 100) return '<100'
  if (n < 1_000) return '100-999'
  if (n < 10_000) return '1K-10K'
  if (n < 100_000) return '10K-100K'
  if (n < 1_000_000) return '100K-1M'
  return '1M+'
}

export const valueType = (v: Value): string => (typeof v === 'string' ? 'text' : isBytes(v) ? 'bytes' : 'json')

/**
 * A search box's query as reported: normalized, or '(redacted)' when it looks like
 * pasted data rather than a search (an address, a URL, a long number or token).
 */
export function searchTerm(query: string): string | null {
  const q = query.trim().toLowerCase().replace(/\s+/g, ' ')
  if (q.length < 2) return null
  if (q.length > 40 || /@|:\/\/|\d{5,}|[a-z0-9+/=_-]{24,}/i.test(q)) return '(redacted)'
  return q
}

/** An error for the `exception` event: quoted fragments (often input) blanked out. */
export function errorDescription(name: string, message: string): string {
  return clip(`${name}: ${message}`.replace(/(["'`])(?:(?!\1).)*\1/g, '$1…$1').replace(/\s+/g, ' ').trim())
}

// --- the tag ---------------------------------------------------------------------

interface Pending { location: string; flush: () => void; cancel: () => void }

interface State {
  gtag: Gtag
  automation: string | null
  /** page_location of the last page view sent; the next one's referrer. */
  sent?: string
  pending?: Pending
  exceptions: number
  errored: Set<string>
  runs: Set<string>
  /** Removes every listener initAnalytics added. */
  teardown: Array<() => void>
}

let state: State | null = null

function listen(s: State, target: EventTarget, type: string, fn: (e: Event) => void,
  options?: AddEventListenerOptions): void {
  target.addEventListener(type, fn, options)
  s.teardown.push(() => target.removeEventListener(type, fn, options))
}

function send(...args: unknown[]): void {
  try { state?.gtag(...args) } catch { /* analytics must never break the app */ }
}

function cleanParams(params: Params): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined) continue
    out[k] = typeof v === 'string' ? clip(v) : v
  }
  return out
}

/** Report an event. A no-op until `initAnalytics()` enabled reporting, and for automation. */
export function track(name: string, params: Params = {}): void {
  if (!state || state.automation) return
  send('event', name, cleanParams(params))
}

/** Reporting is on (production host, not opted out). For tests and conditional work. */
export const analyticsEnabled = (): boolean => state !== null

function readMode(): AnalyticsMode {
  let requested: string | null = null
  try { requested = new URLSearchParams(location.search).get('analytics') } catch { /* no URL API */ }
  if (requested === 'on' || requested === 'off' || requested === 'debug') {
    writePref('analytics', requested)
    // keep the switch out of the address bar (and out of links copied from it)
    try {
      const url = new URL(location.href)
      url.searchParams.delete('analytics')
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
    } catch { /* keep the parameter */ }
    return requested
  }
  const saved = readPref<unknown>('analytics', 'on')
  return saved === 'off' || saved === 'debug' ? saved : 'on'
}

function displayMode(route: Route): string {
  let framed: boolean
  try { framed = window.self !== window.top } catch { framed = true }
  if (framed || route.name === 'embed') return 'embed'
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
  return standalone ? 'standalone' : 'browser'
}

function storageFlag(storage: () => Storage, key: string, set?: boolean): boolean {
  try {
    if (set) storage().setItem(key, '1')
    return storage().getItem(key) === '1'
  } catch { return false }
}

/** Calls `done` once the document title has been quiet for a moment (pages set it after rendering). */
function afterTitleSettles(location: string, done: () => void): Pending {
  let finished = false
  let quiet: ReturnType<typeof setTimeout> | undefined
  const stop = () => {
    finished = true
    clearTimeout(quiet)
    clearTimeout(max)
    observer?.disconnect()
  }
  const flush = () => { if (!finished) { stop(); done() } }
  const restart = () => { clearTimeout(quiet); quiet = setTimeout(flush, TITLE_QUIET_MS) }
  const observer = typeof MutationObserver === 'function' ? new MutationObserver(restart) : null
  const title = document.querySelector('title')
  observer?.observe(title ?? document.head, title ? { childList: true, characterData: true, subtree: true } : { childList: true })
  const max = setTimeout(flush, TITLE_MAX_MS)
  restart()
  return { location, flush, cancel: stop }
}

function pageView(route: Route): void {
  const s = state
  if (!s) return
  const landing = s.sent === undefined && !s.pending
  const location = `${window.location.origin}${canonicalPath(route, window.location.pathname)}`
    + (landing ? campaignQuery(window.location.search) : '')
  if (s.pending ? s.pending.location === location : s.sent === location) return
  s.pending?.cancel()
  const fields = {
    page_location: location,
    page_referrer: s.sent ?? referrerOf(document.referrer, window.location.origin),
    content_group: contentGroup(route),
  }
  // set now, not when the view is sent: any event before it must not fall back to location.href
  send('set', cleanParams(fields))
  s.pending = afterTitleSettles(location, () => {
    s.pending = undefined
    s.sent = location
    const title = clip(document.title)
    send('set', { page_title: title })
    send('event', 'page_view', cleanParams({
      ...fields,
      page_title: title,
      utility_id: route.name === 'utility' ? route.params.id : undefined,
      recipe_id: route.name === 'recipe' ? route.params.slug : undefined,
      automation_signal: s.automation ?? undefined,
    }))
  })
}

/** The first trusted pointer/key/touch/wheel input: a person, not a script, is here. */
function watchForHuman(s: State): void {
  const onInput = (e: Event) => {
    if (!e.isTrusted) return
    for (const type of HUMAN_INPUTS) window.removeEventListener(type, onInput, true)
    storageFlag(() => localStorage, HUMAN_KEY, true)
    send('set', 'user_properties', { visitor_type: 'human' })
    if (!storageFlag(() => sessionStorage, HUMAN_SESSION_KEY)) {
      storageFlag(() => sessionStorage, HUMAN_SESSION_KEY, true)
      track('human_interaction', { interaction_type: e.type })
    }
  }
  for (const type of HUMAN_INPUTS) listen(s, window, type, onInput, { capture: true, passive: true })
}

function watchErrors(s: State): void {
  const report = (name: string, message: string) => {
    if (s.exceptions >= MAX_EXCEPTIONS) return
    s.exceptions++
    track('exception', { description: errorDescription(name, message), fatal: false })
  }
  listen(s, window, 'error', e => {
    const { error, message } = e as ErrorEvent
    // "Script error." from other origins (extensions, ad scripts) carries nothing to act on
    if (!error && (!message || /^script error/i.test(message))) return
    const err = error as Error | undefined
    report(err?.name || 'Error', err?.message || message)
  })
  listen(s, window, 'unhandledrejection', e => {
    const { reason } = e as PromiseRejectionEvent
    const r = reason as { name?: string; message?: string } | undefined
    report(r?.name || 'UnhandledRejection', r?.message || String(reason))
  })
}

export interface AnalyticsOptions {
  /** Hosts that report (tests only; the default is the production site). */
  hosts?: readonly string[]
}

/**
 * Configures GA and starts reporting page views, once, at startup (before React
 * mounts, like the service worker). Does nothing without gtag (tests, blocked
 * scripts), off production, or when this browser opted out.
 */
export function initAnalytics({ hosts = PRODUCTION_HOSTS }: AnalyticsOptions = {}): void {
  if (state || typeof window === 'undefined') return
  const gtag = (window as Window & { gtag?: Gtag }).gtag
  if (typeof gtag !== 'function') return
  const mode = readMode()
  if (mode === 'off') return
  if (mode !== 'debug' && !hosts.includes(window.location.hostname)) return

  const automation = automationSignal(navigator)
  const route = getRoute()
  const s: State = { gtag, automation, exceptions: 0, errored: new Set(), runs: new Set(), teardown: [] }
  state = s
  // the page fields first: nothing the tag sends may fall back to location.href
  pageView(route)
  send('config', MEASUREMENT_ID, { send_page_view: false, ...(mode === 'debug' ? { debug_mode: true } : {}) })
  const human = !automation && storageFlag(() => localStorage, HUMAN_KEY)
  send('set', 'user_properties', {
    visitor_type: automation ? 'automated' : human ? 'human' : 'unverified',
    display_mode: displayMode(route),
    theme: String(readPref<unknown>('theme', 'system')),
  })
  s.teardown.push(onRouteChange(pageView))
  // a pending page view must not be lost when the tab closes during the title wait
  listen(s, window, 'pagehide', () => s.pending?.flush())
  listen(s, document, 'visibilitychange', () => { if (document.visibilityState === 'hidden') s.pending?.flush() })
  if (automation) return
  watchForHuman(s)
  watchErrors(s)
  listen(s, window, 'appinstalled', () => track('pwa_installed'))
}

/** Test-only: stop reporting and remove every listener. */
export function __resetAnalyticsForTests(): void {
  state?.pending?.cancel()
  state?.teardown.forEach(off => off())
  state = null
}

// --- feature helpers -------------------------------------------------------------

/** A utility added to the pipeline, and from where: picker, command_palette, magic, doc_page… */
export function trackUtilityAdd(utilityId: string, method: string): void {
  track('utility_add', { utility_id: utilityId, utility_category: registry.get(utilityId)?.category, method })
}

/** Something done with the pipeline's result (copy, download, share), with the pipeline's shape. */
export function trackPipelineEvent(name: string, steps: PipelineStep[], params: Params = {}): void {
  track(name, { pipeline: pipelineSignature(steps), step_count: countSteps(steps), ...params })
}

/** Input arrived other than by typing: file, drop, paste, clipboard, url, history. */
export function trackInput(method: string, value: Value): void {
  track('input_load', { method, input_type: valueType(value), input_size: sizeBucket(valueSize(value)) })
}

/**
 * `pipeline_run` once a result has stood for RUN_SETTLE_MS — once per distinct pipeline
 * per page, and only after the user changed something (a restored pipeline re-running
 * on load is not a use) and it had something to work on or produced something (a
 * generator needs no input) — plus `step_error` once per failing utility per page.
 */
export function usePipelineRunTracking(steps: PipelineStep[], input: Value,
  result: { out?: Value; err: Record<string, string>; where?: string } | null, ms: number): void {
  const initial = useRef({ steps, input })
  useEffect(() => {
    const s = state
    if (!s || s.automation || !result || steps.length === 0) return
    if (steps === initial.current.steps && input === initial.current.input) return
    if (isEmptyValue(input) && (result.out === undefined || isEmptyValue(result.out))) return
    const timer = setTimeout(() => {
      for (const stepId of Object.keys(result.err)) {
        const step = findStep(steps, stepId)
        if (!step || !isUtilityStep(step) || s.errored.has(step.utilityId)) continue
        s.errored.add(step.utilityId)
        track('step_error', { utility_id: step.utilityId, utility_category: registry.get(step.utilityId)?.category })
      }
      const pipeline = pipelineSignature(steps)
      if (s.runs.has(pipeline)) return
      s.runs.add(pipeline)
      track('pipeline_run', {
        pipeline,
        step_count: countSteps(steps),
        input_type: valueType(input),
        input_size: sizeBucket(valueSize(input)),
        run_where: result.where,
        run_ms: Math.round(ms),
      })
    }, RUN_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [steps, input, result, ms])
}

/** `search` once a search box's query has settled: what was looked for, and whether it was found. */
export function useSearchTracking(where: string, query: string, results: number): void {
  const last = useRef<string | null>(null)
  useEffect(() => {
    const term = searchTerm(query)
    if (!term || term === last.current || !state) return
    const timer = setTimeout(() => {
      last.current = term
      track('search', { search_term: term, search_location: where, results_count: results })
    }, SEARCH_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [where, query, results])
}
