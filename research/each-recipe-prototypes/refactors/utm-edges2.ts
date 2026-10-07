import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/bulk-utm-link-builder/recipe'
import { STRIP_EACH } from './utm'
const OLD = toPipelineSteps(ORIGINAL.steps)
const NEW = toPipelineSteps([ORIGINAL.steps[0], STRIP_EACH, ...ORIGINAL.steps.slice(2)])
const links = [
  'https://www.example.com',
  'https://www.example.com?utm_source=old',
  'www.example.com',
  'www.example.com?utm_medium=old&a=1',
  'https://www.example.com/a?utm_source=old#',
  'https://www.example.com/a?a=1&b=2+3&c=%20x',
  'https://user@www.example.com:8443/a?utm_term=x&k=v',
]
const input = links.join('\r\n') + '\r\n'
const o = await run(input, OLD), n = await run(input, NEW)
const ol = o.out.split('\n'), nl = n.out.split('\n')
ol.forEach((l, i) => console.log(l === nl[i] ? 'same ' : 'DIFF ', l, l === nl[i] ? '' : '\n      ' + nl[i]))
console.log(ol.length, nl.length, JSON.stringify(n.errors))
