import { run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const P = (s: any[]) => toPipelineSteps(s)
const show = (x: any) => console.log(JSON.stringify(x))

// ZIP
const zipSteps = P([each('pad', { mode: 'lines' }, [laneStep('z', 'pad', { length: 5, char: '0', side: 'start' }, { condition: { kind: 'regex', pattern: '^\\d{3,4}$' } })], 'x')])
show(await run('ZIP\r\n2134\r\n501\r\n90210\r\n\r\n7030\r\n02134-1234\r\nK1A 0B6\r\n', zipSteps))
// whole-input pad
show((await run('2134\n501\n', P([step('p', 'pad', { length: 5, char: '0', side: 'start' }, 'x')]))).out)

// CIDR
const cidrSteps = P([each('c', { mode: 'lines' }, [laneStep('i', 'cidr', { mode: 'info' }), laneStep('j', 'jsonpath', { path: "$['network','broadcast']", mode: 'values', indent: 0 })], 'x')])
show((await run('192.0.2.0/24\n198.51.100.128/25\n203.0.113.7/32\n2001:db8::/48\n', cidrSteps)).out)
show((await run('192.0.2.0/24\n198.51.100.128/25', P([step('c', 'cidr', { mode: 'info' }, 'x')]))))
// list to json array
const listSteps = P([each('q', { mode: 'lines' }, [laneStep('e', 'code_string_escape', { language: 'json', wrap: true })], 'x'), step('a', 'jsonl_to_json', {}, 'x')])
show((await run('apple\nsay "hi"\nC:\\temp\n\n42\n', listSteps)).out)
show((await run('apple\nsay "hi"', P([step('a', 'json_escape', {}, 'x')]))).out)
