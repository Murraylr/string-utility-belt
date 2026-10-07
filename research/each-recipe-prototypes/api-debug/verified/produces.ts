import { MANIFEST } from '/home/user/string-utility-belt/src/utilities/_generated/manifest'
for (const m of MANIFEST) {
  const p = Array.isArray(m.produces) ? m.produces : [m.produces]
  if (p.includes('json')) console.log(m.id, JSON.stringify(m.accepts), JSON.stringify(m.produces), m.env)
}
