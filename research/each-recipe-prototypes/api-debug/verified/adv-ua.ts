import { run } from '../../harness'
import recipe from '../ua-recipe'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
async function t(label: string, input: string, s = steps) {
  const { out, errors } = await run(input, s)
  console.log(`\n### ${label}${Object.keys(errors).length ? '  ERRORS ' + JSON.stringify(errors).slice(0, 300) : ''}`)
  console.log(out)
}
await t('no each (sed + uniq_count)', recipe.samples[1].input, [steps[0], steps[2]])
const L = (ip: string, ua: string, req = 'GET / HTTP/1.1') => `${ip} - - [02/Oct/2026:14:20:00 +0000] "${req}" 200 10 "-" "${ua}"`
await t('messy: CRLF, 400 with "-" request, IPv6, blank, Chrome versions, Firefox, Edge, Googlebot', [
  L('203.0.113.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'),
  L('203.0.113.2', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'),
  L('2001:db8::1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0'),
  L('203.0.113.3', 'Mozilla/5.0 (X11; Linux x86_64; rv:143.0) Gecko/20100101 Firefox/143.0'),
  L('203.0.113.4', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
  '',
  `198.51.100.9 - - [02/Oct/2026:14:20:00 +0000] "-" 400 0 "-" "-"`,
  L('203.0.113.5', 'python-requests/2.32.3'),
].join('\n') + '\n')
