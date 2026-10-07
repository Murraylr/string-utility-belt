import { run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { domainToASCII } from 'node:url'
const P = (s: any[]) => toPipelineSteps(s)
const show = (x: any) => console.log(JSON.stringify(x))

// punycode on multi-line, whole input
show((await run('münchen.de\nbücher.example\n', P([step('p', 'punycode_encode', {}, 'x')]))).out)
const names = ['münchen.de', 'Bücher.example', 'MÜNCHEN.DE', 'münchen.de', 'ｍüｎｃｈｅｎ．de', 'straße.example', 'παράδειγμα.example', 'пример.example', '例え.テスト', 'example.com', 'xn--mnchen-3ya.de', 'www.café.example', 'ﬁnance.example', 'bücher。example']
const pipe = (form: string) => P([
  step('n', 'normalize', { form }, 'x'),
  step('lc', 'case', { mode: 'lower' }, 'x'),
  each('e', { mode: 'lines' }, [laneStep('p', 'punycode_encode', { mode: 'domain' })], 'x'),
])
for (const form of ['NFC', 'NFKC']) {
  const r = await run(names.join('\n'), pipe(form))
  const outs = String(r.out).split('\n')
  names.forEach((n, i) => console.log(form, JSON.stringify(n), outs[i], domainToASCII(n), outs[i] === domainToASCII(n) ? 'SAME' : 'DIFF'))
}
