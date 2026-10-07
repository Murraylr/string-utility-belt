import { MANIFEST } from '/home/user/string-utility-belt/src/utilities/_generated/manifest'
for (const m of MANIFEST) {
  const ps = Object.entries(m.params ?? {}).map(([k, p]: any) => `${k}:${p.kind}${p.options ? '(' + p.options.join('|') + ')' : ''}=${JSON.stringify(p.default)}`).join(', ')
  console.log(`${m.id} [${m.category}] env=${m.env.join('/')} :: ${ps}`)
}
console.log(MANIFEST.length)
