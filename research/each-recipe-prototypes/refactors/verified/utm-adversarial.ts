import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import MAIN from '/home/user/string-utility-belt/src/recipes/bulk-utm-link-builder/recipe'
import UTM from '../bulk-utm-link-builder.recipe'
const A = toPipelineSteps(MAIN.steps), B = toPipelineSteps(UTM.steps)
const cases = [
  'https://www.example.com/a?utm_source=a&utm_source=b&x=1',
  'https://www.example.com/a?x=1;utm_source=old',
  'HTTPS://WWW.EXAMPLE.COM/A?Utm_Source=x&B=2',
  'https://www.example.com/page#section&utm_source=x',
  'https://app.example.com/#/signup?utm_source=old&ref=ad',
  'https://www.example.com/r?redirect=https%3A%2F%2Fshop.example.com%2F%3Futm_source%3Dx&utm_medium=old',
  'https://www.example.com/r?redirect=https://shop.example.com/?a=1&utm_source=x',
  'https://www.example.com/s?q=100%&utm_campaign=x',
  'https://www.example.com/s?q=a+b&utm_campaign=x&lang=en',
  '<a href="https://www.example.com/p?id=7&amp;utm_source=old&amp;lang=en">x</a>',
  '<a href="https://www.example.com/p?id=7&#38;utm_source=old">x</a>',
  'https://www.example.com/p?id=7&amp=1',
  'https://www.example.com/p?utm_source=old&&ref=x',
  'https://www.example.com/p?utm_source',
  'https://www.example.com/p?utm_term=a%20b&gclid=abc',
  'Visit https://www.example.com/pricing?utm_medium=email. Or (https://www.example.com/faq?utm_source=a)!',
  'https://www.example.com/p?a=1\r\nhttps://www.example.com/q?utm_source=b\r\n',
  'https://user:pw@[2001:db8::1]:8443/x?utm_source=a&k=v',
  'https://www.example.com/p?UTM_SOURCE=A&utm-source=b',
  'https://www.example.com/p?=x&utm_source=a',
]
for (const c of cases) {
  const a = await run(c, A), b = await run(c, B)
  const same = a.out === b.out
  console.log(`\n${same ? 'SAME' : 'DIFF'} ${JSON.stringify(c)}`)
  if (!same) { console.log('  main ', JSON.stringify(a.out)); console.log('  draft', JSON.stringify(b.out)) } else console.log('  both ', JSON.stringify(b.out))
  if (Object.keys(b.errors).length) console.log('  draft errors', b.errors)
}
// remove unescape lane: does any sample change?
const noAmp = B.map((s: any) => s.id === 'strip' ? { ...s, steps: s.steps.filter((l: any) => l.id !== 'amp') } : s)
for (const s of UTM.samples) console.log('without &amp; lane:', s.id, (await run(s.input, noAmp)).out === s.output ? 'unchanged' : 'CHANGES')
const big = Array.from({ length: 3000 }, (_, i) => `https://www.example.com/p${i}?utm_source=x&id=${i}`).join('\n')
let t = performance.now(); await run(big, B); console.log('3000 links draft', (performance.now() - t).toFixed(0), 'ms')
t = performance.now(); await run(big, A); console.log('3000 links main', (performance.now() - t).toFixed(0), 'ms')
