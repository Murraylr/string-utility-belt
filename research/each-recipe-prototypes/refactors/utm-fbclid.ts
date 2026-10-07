import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import UTM from './bulk-utm-link-builder.recipe'
const steps = toPipelineSteps(UTM.steps).map(s => s.id === 'strip'
  ? { ...s, steps: (s as any).steps.map((l: any) => l.id === 'drop-utm' ? { ...l, params: { ...l.params, drop: 'utm_*, fbclid, gclid' } } : l) } as any : s)
const r = await run('https://www.example.com/pricing?fbclid=IwAR0abc&plan=pro&gclid=Cj0KCQ&UTM_medium=cpc\nhttps://www.example.com/pricing?plan=pro\n', steps)
console.log(JSON.stringify(r.out), r.errors)
