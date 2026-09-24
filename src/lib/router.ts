export type Route = { name: 'home'|'blogIndex'|'blogPost'|'docsIndex'|'docs'|'notFound'; params: Record<string,string> }
export function getRoute(): Route {
  const hash = (location.hash || '#/').slice(1)
  const [path] = hash.split('?')
  if (path === '/' || path === '') return { name: 'home', params: {} }
  if (path === '/blog') return { name: 'blogIndex', params: {} }
  if (path === '/docs') return { name: 'docsIndex', params: {} }
  if (path.startsWith('/docs/')) return { name: 'docs', params: { id: decodeURIComponent(path.slice('/docs/'.length)) } }
  if (path.startsWith('/blog/')) return { name: 'blogPost', params: { slug: path.slice('/blog/'.length) } }
  return { name: 'notFound', params: {} }
}
export function onRouteChange(cb: (r: Route)=>void) {
  const h = () => cb(getRoute())
  window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h)
}
