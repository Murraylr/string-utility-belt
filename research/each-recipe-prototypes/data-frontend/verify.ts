import { recipe as L } from './list-to-json-array'
import { recipe as D } from './extract-domains-from-urls'
for (const s of L.samples) {
  const want = s.input.split(/\r?\n/).map(x => x.trim()).filter(Boolean)
  console.log('json-array', s.id, JSON.stringify(JSON.parse(s.output)) === JSON.stringify(want))
}
for (const s of D.samples) {
  const want = s.input.split('\n').slice(0, -1).map(l => { const t = l.trim(); if (!t) return ''; const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(t) ? t : 'https://' + t); return u.hostname.replace(/^www\./, '') }).join('\n') + '\n'
  console.log('domains', s.id, want === s.output)
}
