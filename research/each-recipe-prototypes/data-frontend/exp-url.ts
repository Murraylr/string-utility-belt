import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'

const hostEach = each('host', { mode: 'lines' }, [
  laneStep('scheme', 'line_affix', { prefix: 'https://', suffix: '', skipBlank: true, joinWith: '' }, { condition: { kind: 'regex', pattern: '^[a-z][a-z0-9+.-]*://', flags: 'i', negate: true } }),
  laneStep('parse', 'url_parse', { base: '', decodeParams: true }),
  laneStep('pick', 'jsonpath', { path: '$.hostname', mode: 'first', indent: 2 }),
], 'x x x x x x')
const steps = toPipelineSteps([hostEach])
const inputs = [
  'https://www.example.com/blog/post-1?utm_source=news\nhttp://Shop.Example.org:8080/cart\nexample.net/about\nwww.example.com/contact\n//cdn.example.com/a.js\nhttps://user:pw@api.example.com/v1\nhttp://[2001:db8::1]:8080/\nhttp://192.0.2.10/admin\nhttps://bücher.example/\n  https://spaces.example.com/  \nmailto:info@example.com\nnot a url\n\nftp://files.example.com/pub\n',
  'https://www.example.com/a\r\nhttps://example.com/b\r\n',
]
for (const i of inputs) {
  const r = await run(i, steps)
  console.log(JSON.stringify(r.out), JSON.stringify(r.errors))
}
const withCount = toPipelineSteps([hostEach,
  step('www', 'replace', { pattern: '^www\\.', replacement: '', regex: true, flags: 'gm' }, 'x x x x x x'),
  step('count', 'uniq_count', { sort: 'count-desc', separator: '\\t', format: 'count-line' }, 'x x x x x x')])
console.log((await run('https://www.example.com/a\nhttps://example.com/b\nhttps://blog.example.org/x\nhttps://www.example.com/c\n', withCount)).out)
