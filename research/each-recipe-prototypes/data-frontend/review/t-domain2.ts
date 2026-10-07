import { proto, run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe as orig } from '../extract-domains-from-urls'
import { recipe } from '../verified/extract-domains-from-urls'
const O = toPipelineSteps(orig.steps)
console.log('ORIGINAL on tab paste:', JSON.stringify((await run('https://example.com\tHome page\nhttps://example.com/x\tAbout\n', O)).out))
await proto(recipe)
const S = toPipelineSteps(recipe.steps)
for (const v of ['See https://example.com/x for details\n', 'Landing page\nhttps://example.com/\n', '# links\nhttps://example.com/\n', 'https://en.example.org/wiki/Foo_(bar)\n', '(https://example.com/x)\n', 'https://example.com/?ids=1,2\n', 'https://example.com/ \n']) {
  const r = await run(v, S); console.log(JSON.stringify(v), '->', JSON.stringify(r.out), Object.keys(r.errors).length ? JSON.stringify(r.errors['host-each']) : '')
}
