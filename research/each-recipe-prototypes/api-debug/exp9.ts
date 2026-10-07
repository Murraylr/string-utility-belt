import { show, U, E } from './util'
const uas = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  'okhttp/4.12.0', 'okhttp/3.14.9',
  'OrdersApp/3.2.1 (iPhone; iOS 18.6; Scale/3.00)',
  'OrdersApp/3.2.1 CFNetwork/1568.100.1 Darwin/24.0.0',
  'Dalvik/2.1.0 (Linux; U; Android 14; Pixel 8 Build/AP2A.240805.005)',
  'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)',
  'axios/1.7.7', 'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)', 'Java/17.0.12', 'Apache-HttpClient/4.5.14 (Java/17.0.12)', 'aws-sdk-go/1.55.5 (go1.22.5; linux; amd64)', '-',
]
for (const [label, params] of [
  ['csv space', { header: false, flatten: true, columns: 'browser.name,browser.version,os.name', delimiter: ' ' }],
  ['csv slash', { header: false, flatten: true, columns: 'browser.name,browser.version,os.name,device.type', delimiter: ' / ' }],
  ['csv tab', { header: false, flatten: true, columns: 'browser.name,browser.version,os.name', delimiter: '\t' }],
] as const) {
  await show(label, uas.join('\n'), [E('parse', { mode: 'lines' }, [U('p', 'user_agent_parse', {}), U('c', 'json_to_csv', params)])])
}
