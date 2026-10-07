import { run } from '../harness'
import { recipe } from './user-agents-to-csv-def'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
const cases: Record<string, string> = {
  quoted: '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"\n',
  leadingSpace: '   curl/8.7.1   \n',
  logLine: '192.0.2.10 - - [07/Oct/2026:10:00:00 +0000] "GET / HTTP/1.1" 200 512 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"\n',
  unicode: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36 ✓ ünïcode\n',
  onlyBlank: '\n\n',
  empty: '',
  noTrailing: 'curl/8.7.1',
  gptbot: 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  header: 'user_agent\ncurl/8.7.1',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, steps)
  console.log(`--- ${k}`, JSON.stringify(r.errors))
  console.log(r.out)
}
