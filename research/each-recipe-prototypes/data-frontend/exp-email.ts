import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'

const steps = toPipelineSteps([
  step('spaces', 'replace', { pattern: '[^\\S\\r\\n]+', replacement: '', regex: true, flags: 'g' }, 'x x x x x x'),
  step('lower', 'case', { mode: 'lower' }, 'x x x x x x'),
  step('gmail', 'replace', { pattern: '\\.(?=[^@\\s]*@(?:gmail|googlemail)\\.com$)', replacement: '', regex: true, flags: 'gm' }, 'x x x x x x'),
])
const hashEach = toPipelineSteps([each('hash', { mode: 'lines' }, [laneStep('sha', 'hash', { algo: 'SHA-256' })], 'x x x x x x')])
const inputs = [
  ' Jane.Doe@Example.com \nj.smith.84@gmail.com\n\nALEX.RIVERA@GoogleMail.com \nsupport.team@example.org\n',
  'a.b@gmail.com\r\nc.d@gmail.com\r\n',
  'x.y@gmail.co.uk\nx.y@gmail.com.example.net\nfoo@sub.gmail.com\n"Quoted.Name"@gmail.com\nName <a.b@gmail.com>\na.b@gmail.com,extra\n',
  '​zw.space@gmail.com\ntab\there@example.com\nÜser@Exämple.de\n',
]
for (const i of inputs) {
  const r = await run(i, steps)
  console.log(JSON.stringify(r.out), r.errors)
  const h = await run(r.out, hashEach)
  console.log(JSON.stringify(h.out), h.errors)
}
