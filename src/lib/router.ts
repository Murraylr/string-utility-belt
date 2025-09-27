export type Route = { name: 'home'|'blogIndex'|'blogPost'|'notFound'; params: Record<string,string> }
export function getRoute(): Route {
  const hash = (location.hash || '#/').slice(1)
  const [path] = hash.split('?')
  if (path === '/' || path === '') return { name: 'home', params: {} }
  if (path === '/blog') return { name: 'blogIndex', params: {} }
  if (path.startsWith('/blog/')) return { name: 'blogPost', params: { slug: path.slice('/blog/'.length) } }
  return { name: 'notFound', params: {} }
}
export function onRouteChange(cb: (r: Route)=>void) {
  const h = () => cb(getRoute())
  window.addEventListener('hashchange', h); return () => window.removeEventListener('hashchange', h)
}
