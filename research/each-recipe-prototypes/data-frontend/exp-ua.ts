import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.6668.70 Mobile Safari/537.36',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'curl/8.5.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
]
const input = UAS.join('\n') + '\n'
const A = toPipelineSteps([
  each('parse-each', { mode: 'lines' }, [laneStep('ua', 'user_agent_parse')], 'x x x x x x'),
  step('rows', 'jsonl_to_json', { indent: 2, skipBlank: true, onError: 'error' }, 'x x x x x x'),
  step('csv', 'json_to_csv', { delimiter: ',', header: true, flatten: true, eol: 'lf', columns: 'browser.name,browser.major,os.name,os.version,device.type,isBot' }, 'x x x x x x'),
])
let r = await run(input, A); console.log(r.out, r.errors)
// count variant
const lane = (id: string, path: string) => [laneStep(`${id}-p`, 'user_agent_parse'), laneStep(`${id}-j`, 'jsonpath', { path, mode: 'first' })]
const B = toPipelineSteps([
  each('name-each', { mode: 'lines' }, [
    { id: 'br', type: 'branch', enabled: true, branches: [lane('b', '$.browser.name'), lane('o', '$.os.name')], merge: { mode: 'concat', separator: ' on ' } } as any,
  ], 'x x x x x x'),
  step('count', 'uniq_count', { sort: 'count-desc', separator: '\\t' }, 'x x x x x x'),
])
r = await run(input, B); console.log(r.out, r.errors)
