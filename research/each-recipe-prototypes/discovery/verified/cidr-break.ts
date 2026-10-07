import { run } from '../../harness'
import { recipe } from '../cidr-def'
import { each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
const alt = toPipelineSteps([each('e', { mode: 'lines' }, [laneStep('i', 'cidr', { mode: 'info' }, { condition: { kind: 'regex', pattern: '^\\s*[0-9A-Fa-f:.]+(/\\d{1,3})?\\s*$' } }), laneStep('c', 'json_to_csv', { header: false, columns: 'network,broadcast', delimiter: '-' }, { condition: { kind: 'type', type: 'json' } })], 'x')])
for (const input of ['198.51.100.0/24 # office\n203.0.113.0/27\n', '198.51.100.0/24,Office VPN\n', '198.51.100.0 /24\n', '198.51.100.0/2x\n', '198.51.100.0/24 \n', '- 198.51.100.0/24\n', '"198.51.100.0/24",\n', '# office egress\r\n198.51.100.37/29\r\n\r\n203.0.113.200/30\r\n']) {
  const r = await run(input, steps); const a = await run(input, alt)
  console.log(JSON.stringify(input).padEnd(40), '->', JSON.stringify(r.out), Object.keys(r.errors).length ? 'ERR' : '', '| alt:', JSON.stringify(a.out), Object.keys(a.errors).length ? JSON.stringify(a.errors) : '')
}
