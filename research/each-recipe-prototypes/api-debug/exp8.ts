import { show, U, E } from './util'
const uas = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
  'curl/8.5.0',
  'python-requests/2.32.3',
  'okhttp/4.12.0',
  'PostmanRuntime/7.43.0',
  'Go-http-client/2.0',
  'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
]
const log = uas.map((ua, i) => `203.0.113.${10 + i} - - [01/Oct/2026:10:00:0${i} +0000] "GET /v1/orders HTTP/1.1" 200 512 "-" "${ua}"`).join('\n') + '\n'
const steps = [
  U('ua', 'sed', { script: 's/^.*"([^"]*)"\\s*$/\\1/', perLine: true }),
  E('parse', { mode: 'lines' }, [U('p', 'user_agent_parse', {}), U('c', 'json_to_csv', { header: false, flatten: true, columns: 'browser.name,browser.major,os.name,device.type', delimiter: ' / ' })]),
  U('count', 'uniq_count', {}),
]
await show('ua: sed', log, steps.slice(0, 1))
await show('ua: parse', log, steps.slice(0, 2))
await show('ua: full', log, steps)
await show('raw parse json for api clients', 'python-requests/2.32.3', [U('p', 'user_agent_parse', {})])
