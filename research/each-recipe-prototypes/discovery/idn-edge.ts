import { run } from '../harness'
import { recipe } from './idn-def'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { domainToASCII } from 'node:url'
import { step, each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
const steps = toPipelineSteps(recipe.steps)
const noTrim = toPipelineSteps([...recipe.steps.slice(0, 3), each('e', { mode: 'lines' }, [laneStep('p', 'punycode_encode', {})], 'x')])
for (const input of [' straße.example', 'ÄRZTEHAUS.example', 'Ärztehaus.example', 'bücher.example.\r\nwww.bücher.example\r\n', 'user@bücher.example', 'https://bücher.example/pfad', 'bücher.example, café.example', '☃.example', 'xn--bcher-kva.example', '#  comment über', 'a‍b.example', 'ﬁnance.example', 'münchen.example', '', '\n\n']) {
  const a = await run(input, steps)
  const b = await run(input, noTrim)
  const lines = input.split(/\r?\n/)
  console.log(JSON.stringify(input), '->', JSON.stringify(a.out), '| noTrim', JSON.stringify(b.out), '| node', JSON.stringify(lines.map(l => l.trim() && domainToASCII(l.trim())).join('\n')), JSON.stringify(a.errors))
}
