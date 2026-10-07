import { run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const P = (s: any[]) => toPipelineSteps(s)

const UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.2739.42',
  'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'curl/8.7.1',
  '-',
].join('\n') + '\n'

const steps = P([
  each('parse', { mode: 'lines' }, [laneStep('ua', 'user_agent_parse')], 'x'),
  step('rows', 'jsonl_to_json', {}, 'x'),
  step('csv', 'json_to_csv', { flatten: true }, 'x'),
])
let r = await run(UAS, steps)
console.log(r.out, r.errors)
r = await run(UAS, P([each('parse', { mode: 'lines' }, [laneStep('ua', 'user_agent_parse')], 'x')]))
console.log(r.out, r.errors)
