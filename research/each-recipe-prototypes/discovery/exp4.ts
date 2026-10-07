import { run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { sanitizeSteps } from '/home/user/string-utility-belt/src/core/serialize'
import { domainToASCII } from 'node:url'
const P = (s: any[]) => toPipelineSteps(s)
const show = (x: any) => console.log(JSON.stringify(x))
const inner = { id: 'words', type: 'each', enabled: true, split: { mode: 'delimiter', separator: ' ' }, skipEmpty: true, steps: [laneStep('p', 'punycode_encode', { mode: 'domain' })] }
const steps = P([
  step('n', 'normalize', { form: 'NFKC' }, 'x'),
  step('lc', 'case', { mode: 'lower' }, 'x'),
  each('e', { mode: 'lines' }, [inner as any], 'x'),
])
show(JSON.stringify(sanitizeSteps(steps)) === JSON.stringify(steps))
show((await run('    server_name bücher.example www.bücher.example;\ncertbot certonly -d bücher.example -d www.bücher.example\n  café.example  \n', steps)).out)
show(domainToASCII('ΠΑΡΆΔΕΙΓΜΑ.example'))
show((await run('ΠΑΡΆΔΕΙΓΜΑ.example', P([step('lc', 'case', { mode: 'lower' }, 'x'), each('e', { mode: 'lines' }, [laneStep('p', 'punycode_encode', {})], 'x')]))).out)
show(domainToASCII('İstanbul.example'))
show((await run('İstanbul.example', P([step('lc', 'case', { mode: 'lower' }, 'x'), each('e', { mode: 'lines' }, [laneStep('p', 'punycode_encode', {})], 'x')]))).out)
