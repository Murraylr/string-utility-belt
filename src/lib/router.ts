export type RouteName =
  | 'home'
  /** A shared pipeline: `#/p/<payload>` */
  | 'pipeline'
  /** Minimal iframe view of a shared pipeline: `#/embed/<payload>` */
  | 'embed'
  /** How to use the tool: the pre-rendered `/docs/`, or `#/docs` */
  | 'docs'
  | 'blogIndex'
  | 'blogPost'
  /** Index of every utility: `#/utilities` */
  | 'utilities'
  /** One utility's documentation: `#/util/<id>`, or the pre-rendered `/util/<id>` */
  | 'utility'
  | 'changelog'
  /** A site page (about, privacy policy, contact): `/<slug>/` or `#/<slug>` */
  | 'page'
  | 'notFound'

export type Route = { name: RouteName; params: Record<string, string> }

/** Slugs of the site pages, each pre-rendered at `/<slug>/` from `src/app/pages/content/<slug>.md`. */
export const SITE_PAGES = ['about', 'privacy', 'contact', 'integrations'] as const
export type SitePageSlug = (typeof SITE_PAGES)[number]

const isSitePage = (slug: string | undefined): slug is SitePageSlug =>
  (SITE_PAGES as readonly string[]).includes(slug ?? '')

const NOT_FOUND: Route = { name: 'notFound', params: {} }

/** Links are untrusted: a malformed escape (`%E0%A4%A`) must not throw out of getRoute. */
function safeDecode(s: string): string | null {
  try { return decodeURIComponent(s) } catch { return null }
}

const utilityRoute = (raw: string): Route => {
  const id = safeDecode(raw)
  return id === null ? NOT_FOUND : { name: 'utility', params: { id } }
}

/**
 * A blog slug becomes a path under `/blog/` (`fetch('/blog/<slug>.md')`), so none of
 * its segments may be a dot segment or smuggle a separator, encoded or not.
 */
const blogRoute = (segments: string[]): Route => {
  const ok = segments.every(seg => {
    const s = safeDecode(seg)
    return s !== null && s !== '.' && s !== '..' && !/[/\\]/.test(s)
  })
  return ok ? { name: 'blogPost', params: { slug: segments.join('/') } } : NOT_FOUND
}

const isHomePath = (pathname: string) => pathname === '/' || pathname === '/index.html'

/** Pre-rendered static pages live at real paths; the hash takes precedence when present. */
function routeFromPath(pathname: string): Route | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'util' && parts[1]) return utilityRoute(parts[1])
  if (parts[0] === 'utilities' && parts.length === 1) return { name: 'utilities', params: {} }
  if (parts[0] === 'docs' && parts.length === 1) return { name: 'docs', params: {} }
  if (parts[0] === 'blog' && parts.length === 1) return { name: 'blogIndex', params: {} }
  if (parts[0] === 'blog' && parts[1]) return blogRoute(parts.slice(1))
  if (parts[0] === 'changelog') return { name: 'changelog', params: {} }
  if (parts.length === 1 && isSitePage(parts[0])) return { name: 'page', params: { slug: parts[0] } }
  return null
}

export function getRoute(): Route {
  // tolerant parsing: strip ?query, ignore empty segments and a missing
  // leading slash so hand-typed hashes like '#blog' or '#/blog/' still route
  // Only a page with NO hash routes by its real path (pre-rendered /util/<id>/ pages).
  // An explicit '#/' is the tool, even on a pre-rendered path. Any other path is not
  // a page: the host answered it with its fallback (index.html, or 404.html).
  const pathname = location.pathname || '/'
  if (!location.hash) {
    return routeFromPath(pathname) ?? (isHomePath(pathname) ? { name: 'home', params: {} } : NOT_FOUND)
  }
  // On a pre-rendered page a fragment without a leading '/' (`/integrations/#cli`) is an
  // in-page anchor, not a route: only `#/…` re-routes there. The home path keeps the
  // tolerant parsing below, so a hand-typed `/#blog` still reaches the blog.
  if (fragmentId() !== null) {
    const page = routeFromPath(pathname)
    if (page) return page
  }
  const hash = location.hash.replace(/^#/, '').trim()
  if (!hash || hash === '/') return { name: 'home', params: {} }
  const [path] = hash.split('?')
  const parts = path.split('/').filter(Boolean)
  const head = parts[0] || ''
  if (!head) return { name: 'home', params: {} }
  // share payloads are opaque: keep everything after the prefix, slashes included
  if (head === 'p' || head === 'embed') {
    const payload = path.replace(/^\/?(p|embed)\/?/, '')
    if (!payload) return head === 'p' ? { name: 'home', params: {} } : { name: 'notFound', params: {} }
    return { name: head === 'p' ? 'pipeline' : 'embed', params: { payload } }
  }
  if (head === 'docs' && parts.length === 1) return { name: 'docs', params: {} }
  if (head === 'blog' && parts.length === 1) return { name: 'blogIndex', params: {} }
  if (head === 'blog') return blogRoute(parts.slice(1))
  if (head === 'utilities' && parts.length === 1) return { name: 'utilities', params: {} }
  if (head === 'util' && parts[1]) return utilityRoute(parts[1])
  if (head === 'changelog') return { name: 'changelog', params: {} }
  if (parts.length === 1 && isSitePage(head)) return { name: 'page', params: { slug: head } }
  return { name: 'notFound', params: {} }
}

export function onRouteChange(cb: (r: Route) => void) {
  const h = () => cb(getRoute())
  window.addEventListener('hashchange', h)
  window.addEventListener('popstate', h)
  return () => { window.removeEventListener('hashchange', h); window.removeEventListener('popstate', h) }
}

/**
 * In-app navigation to a real path — a pre-rendered page such as `/util/<id>/` —
 * without a reload. Links keep crawlable path hrefs (search engines drop `#/…`
 * fragments) while clicks still stay inside the running app.
 */
export function navigateToPath(path: string) {
  // a link to the page already showing re-renders it without stacking a history entry
  if (path !== location.pathname + location.hash) history.pushState(history.state, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  // a page that renders later (a lazy chunk) scrolls to its own anchor: see `scrollToFragment`
  if (!scrollToFragment()) window.scrollTo?.(0, 0)
}

/** The in-page anchor id in the address (`#cli` → `cli`), or null for none or a `#/…` route. */
export function fragmentId(): string | null {
  const raw = location.hash.slice(1)
  if (!raw || raw.startsWith('/')) return null
  return safeDecode(raw)
}

/**
 * Scrolls the address's in-page anchor into view, when the page shows it. For a
 * page that renders after navigation (a lazy route) to call once its content is in.
 */
export function scrollToFragment(): boolean {
  const id = fragmentId()
  const target = id === null ? null : document.getElementById(id)
  target?.scrollIntoView?.()
  return !!target
}

// a post only by its pre-rendered `/blog/<slug>/` (slash required): `/blog/<slug>.md`
// and `/blog/_manifest.json` are files beside the posts, not pages. A pre-rendered page
// may carry an in-page anchor; the home page may not (its fragment is a route).
const IN_APP_PATH = new RegExp(
  `^/(?:|(?:docs/?|utilities/?|util/[^/?#]+/?|blog/?|blog/[^?#]+/|changelog/?|(?:${SITE_PAGES.join('|')})/?)(?:#[A-Za-z][\\w-]*)?)$`,
)

/**
 * Paths `navigateToPath` may take over from a link click: the home page and
 * every pre-rendered page (optionally with an in-page `#anchor`) — what the
 * router resolves from a real path.
 */
export const isInAppPath = (href: string): boolean => IN_APP_PATH.test(href)

/** A click the browser would handle as "follow here": no modifier keys, main button, no target. */
export function isPlainLeftClick(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }, anchor?: Element | null): boolean {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false
  const target = anchor?.getAttribute('target')
  return !target || target === '_self'
}

/** Replace the hash without adding a history entry (e.g. after importing a share link). */
export function replaceHash(hash: string) {
  const url = `${location.pathname}${location.search}${hash}`
  history.replaceState(history.state, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
