import { MANIFEST } from '/home/user/string-utility-belt/src/utilities/_generated/manifest'
import { existsSync, readFileSync } from 'node:fs'
const ids = process.argv.slice(2)
for (const m of MANIFEST) {
  if (ids.length && !ids.includes(m.id)) continue
  const p = Object.entries(m.params ?? {}).map(([k, s]: any) => `${k}:${s.kind}${s.options ? '[' + s.options.join('|') + ']' : ''}=${JSON.stringify(s.default)}`).join(', ')
  const g = `/home/user/string-utility-belt/src/utilities/${m.id}/guide.md`
  const title = existsSync(g) ? (readFileSync(g, 'utf8').match(/^title:\s*(.*)$/m)?.[1] ?? '') : ''
  console.log(`${m.id} [${m.category}] ${JSON.stringify(m.accepts)}->${JSON.stringify(m.produces)} env=${m.env.join(',')} :: ${p}\n    TITLE: ${title}`)
}
