(globalThis as any).__LIB = true
import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/bulk-utm-link-builder/recipe'
import { UTM } from './utm'

const OLD = toPipelineSteps(ORIGINAL.steps)
const NEW = toPipelineSteps(UTM.steps)

const cases: Record<string, string> = {
  'utm key with digits (utm_content2)': 'https://www.example.com/a?utm_content2=hero&x=1',
  'utm key without = (utm_source alone)': 'https://www.example.com/a?utm_source&ref=nav',
  'utm_id and utm_source_platform': 'https://www.example.com/a?utm_id=42&utm_source_platform=ads&q=1',
  'percent-encoded key %75tm_source': 'https://www.example.com/a?%75tm_source=old&q=1',
  'empty pair && in a non-utm link': 'https://www.example.com/a?x=1&&y=2',
  'utm inside a hash route': 'https://app.example.com/#/signup?utm_source=old&plan=pro',
  'repeated non-utm key': 'https://www.example.com/a?tag=red&tag=blue&utm_medium=old',
  'uppercase host': 'https://WWW.Example.com/Pricing?utm_source=old',
  '&amp;region (legacy-entity trap)': '<a href="https://www.example.com/stores?country=us&amp;region=west&amp;utm_source=old">x</a>',
  'value contains utm_ text': 'https://www.example.com/search?q=utm_source%3Dx&utm_source=old',
  'utm then fragment with no other params': 'https://www.example.com/a?utm_source=old&utm_medium=old#top',
}

for (const [name, input] of Object.entries(cases)) {
  const o = await run(input, OLD)
  const n = await run(input, NEW)
  console.log(`\n### ${name}\n  in   ${input}`)
  console.log(`  main ${o.out}${Object.keys(o.errors).length ? ' ' + JSON.stringify(o.errors) : ''}`)
  console.log(`  each ${n.out}${Object.keys(n.errors).length ? ' ' + JSON.stringify(n.errors) : ''}${o.out === n.out ? '   (same)' : '   (DIFFERS)'}`)
}

// why the step must be a "run on each": the utility reads its whole input as one URL
const whole = await run('https://www.example.com/a?utm_source=x\nhttps://www.example.com/b?ref=1&utm_medium=y', [
  { id: 'q', utilityId: 'query_params_normalize', enabled: true, params: { sort: false, dedupe: 'none', drop: 'utm_*', lowercaseHost: false } } as any,
])
console.log('\nquery_params_normalize on two lines at once:', JSON.stringify(whole.out))
