import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { step } from '/home/user/string-utility-belt/src/recipes/define'
import { recipe } from '../extract-domains-from-urls'
const S = toPipelineSteps(recipe.steps)
// one-step alternative: regex replace + lowercase, no each
const ALT = toPipelineSteps([
  step('rx', 'replace', { pattern: '^[^\\S\\r\\n]*(?:[a-z][a-z0-9+.-]*:)?(?://)?(?:[^@/\\s]*@)?(?:www\\.)?(\\[[^\\]]*\\]|[^/:?#\\s]*)[^\\r\\n]*', replacement: '$1', regex: true, flags: 'gim' }, 'x x x x x x'),
  step('lc', 'case', { mode: 'lower' }, 'x x x x x x'),
])
const cases: Record<string, string> = {
  s1: recipe.samples[0].input, s2: recipe.samples[1].input,
  prose: 'See https://example.com/x for details\n',
  header: 'URL\nhttps://example.com/\n',
  header2: 'Landing page\nhttps://example.com/\n',
  comment: '# links\nhttps://example.com/\n',
  htmlEsc: 'https://example.com/?a=1&amp;b=2\n',
  hrefTag: '<a href="https://example.com/x">x</a>\n',
  quoted: '"https://example.com/x"\n',
  trailingComma: 'https://example.com/x,\n',
  idn: 'https://bücher.example/\n',
  mailto: 'mailto:info@example.com\n',
  ws: '   \n',
  tabs: 'https://a.example.com\thttps://b.example.com\n',
  bareHost: 'localhost:3000/x\n',
  portNoScheme: 'example.com:8080/x\n',
  ipNoScheme: '192.0.2.1/admin\n',
  backslash: 'https:\\\\example.com\\path\n',
  protoRel: '//cdn.example.com/x.js\n',
  long: 'https://example.com/' + 'a'.repeat(50000) + '\n',
  javascript: 'javascript:alert(1)\n',
  file: 'file:///C:/x.html\n',
  data: 'data:text/plain,hello\n',
  crlf: 'https://www.example.com/\r\nexample.org\r\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, S); const a = await run(v, ALT)
  const show = (x: any) => JSON.stringify(String(x).slice(0, 100))
  console.log(`--- ${k}: ${show(v)}\n  each: ${show(r.out)} ${Object.keys(r.errors).length ? JSON.stringify(r.errors).slice(0, 200) : ''}\n  alt : ${show(a.out)}`)
}
