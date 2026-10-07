import { run } from '../../harness'
import { recipe } from './ua-def'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
const uas = ['kube-probe/1.31', 'ELB-HealthChecker/2.0', 'Prometheus/2.53.0', 'Uptime-Kuma/1.23.13', 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)', 'Twitterbot/1.0', 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)', 'WhatsApp/2.23.20.0', 'Amazon CloudFront', 'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)', 'Mozilla/5.0 (Linux; Android 5.0) AppleWebKit/537.36 (KHTML, like Gecko) Mobile Safari/537.36 (compatible; Bytespider; spider-feedback@bytedance.com)', 'Go-http-client/1.1', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/128.0.0.0 Safari/537.36', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15 (Applebot/0.1; +http://www.apple.com/go/applebot)', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36']
const r = await run(uas.join('\n') + '\n', steps)
const rows = r.out.split('\n')
console.log(rows[0]); uas.forEach((u, i) => console.log(rows[i + 1].padEnd(60), '<=', u.slice(0, 60)))
