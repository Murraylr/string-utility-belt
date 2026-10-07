import { proto } from '../../harness'
import { STATIC_RECIPES } from '/home/user/string-utility-belt/src/recipes/_generated/static'
const res: Record<string, number> = {}
for (const r of STATIC_RECIPES) res[r.slug] = (await proto(r)).length
console.log('\nSUMMARY', JSON.stringify(res))
