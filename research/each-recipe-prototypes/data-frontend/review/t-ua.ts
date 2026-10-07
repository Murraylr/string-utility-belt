import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe } from '../parse-user-agent-list-to-csv'
const S = toPipelineSteps(recipe.steps)
const CH = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36'
const cases: Record<string, string> = {
  crlf: CH + '\r\n' + 'curl/8.5.0\r\n',
  header: 'user_agent\n' + CH + '\n',
  quotedCsv: `"${CH}"\n"curl/8.5.0"\n`,
  combinedLog: `203.0.113.7 - - [07/Oct/2026:10:00:00 +0000] "GET / HTTP/1.1" 200 512 "https://example.com/" "${CH}"\n`,
  dash: '-\n' + CH + '\n',
  jsonEscaped: JSON.stringify(CH) + '\n',
  emptyAll: '',
  blanksOnly: '\n\n',
  wsLine: '   \n' + CH + '\n',
  weird: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36\nMozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1\nMozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)\nMozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)\nfacebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)\nMozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/129.0.0.0 Safari/537.36\n',
  long: 'Mozilla/5.0 ' + 'x'.repeat(20000) + '\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, S)
  console.log(`--- ${k}\n${JSON.stringify(r.out)}\n${Object.keys(r.errors).length ? JSON.stringify(r.errors).slice(0, 300) : ''}`)
}
const big = Array.from({ length: 5000 }, () => CH).join('\n')
const t0 = Date.now(); const rb = await run(big, S); console.log('5000 UAs ms', Date.now() - t0, String(rb.out).split('\n').length)
