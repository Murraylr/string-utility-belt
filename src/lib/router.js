// Lightweight hash-based router used by App.jsx and Blog views
export function getRoute(){
  const hash = location.hash.replace(/^#/, '').trim()
  const parts = hash.split('/').filter(Boolean)
  const head = parts[0] || ''
  if (!head) return { name: 'home', params: {} }
  if (head === 'blog' && parts.length === 1) return { name: 'blogIndex', params: {} }
  if (head === 'blog' && parts.length >= 2) return { name: 'blogPost', params: { slug: parts.slice(1).join('/') } }
  return { name: 'notFound', params: { hash } }
}

export function onRouteChange(cb){
  const handler = () => cb(getRoute())
  window.addEventListener('hashchange', handler)
  return () => window.removeEventListener('hashchange', handler)
}
