export type RouteName =
  | 'home'
  /** A shared pipeline: `#/p/<payload>` */
  | 'pipeline'
  /** Minimal iframe view of a shared pipeline: `#/embed/<payload>` */
  | 'embed'
  /** How to use the tool: `#/docs` */
  | 'docs'
  | 'blogIndex'
  | 'blogPost'
  /** Index of every utility: `#/utilities` */
  | 'utilities'
  /** One utility's documentation: `#/util/<id>`, or the pre-rendered `/util/<id>` */
  | 'utility'
  | 'changelog'
  | 'notFound'

export type Route = { name: RouteName; params: Record<string, string> }

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

/** Pre-rendered static pages live at real paths; the hash takes precedence when present. */
function routeFromPath(pathname: string): Route | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'util' && parts[1]) return utilityRoute(parts[1])
  if (parts[0] === 'utilities' && parts.length === 1) return { name: 'utilities', params: {} }
  if (parts[0] === 'blog' && parts.length === 1) return { name: 'blogIndex', params: {} }
  if (parts[0] === 'blog' && parts[1]) return blogRoute(parts.slice(1))
  if (parts[0] === 'changelog') return { name: 'changelog', params: {} }
  return null
}

export function getRoute(): Route {
  // tolerant parsing: strip ?query, ignore empty segments and a missing
  // leading slash so hand-typed hashes like '#blog' or '#/blog/' still route
  // Only a page with NO hash routes by its real path (pre-rendered /util/<id>/ pages).
  // An explicit '#/' is the tool, even on a pre-rendered path — that is where the
  // header's "Tool" link points.
  if (!location.hash) return routeFromPath(location.pathname || '/') ?? { name: 'home', params: {} }
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
  return { name: 'notFound', params: {} }
}

export function onRouteChange(cb: (r: Route) => void) {
  const h = () => cb(getRoute())
  window.addEventListener('hashchange', h)
  window.addEventListener('popstate', h)
  return () => { window.removeEventListener('hashchange', h); window.removeEventListener('popstate', h) }
}

/** Replace the hash without adding a history entry (e.g. after importing a share link). */
export function replaceHash(hash: string) {
  const url = `${location.pathname}${location.search}${hash}`
  history.replaceState(history.state, '', url)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}
