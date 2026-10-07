import { STATIC_RECIPES } from '/home/user/string-utility-belt/src/recipes/_generated/static'
for (const r of STATIC_RECIPES) console.log(r.slug, r.steps.length, r.steps.map((s: any) => s.type ?? s.utilityId).join(' > '))
