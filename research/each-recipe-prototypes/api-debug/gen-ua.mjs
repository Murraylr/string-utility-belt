const CH_WIN = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const CH_MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const SAF_IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'
const APP = 'OrdersApp/3.2.1 (iPhone; iOS 18.6; Scale/3.00)'
// nginx default "main" format: ... "$http_user_agent" "$http_x_forwarded_for"
const main = [
  ['192.0.2.14', '10:00:01', 'GET /v1/orders HTTP/1.1', 200, 'okhttp/4.12.0'],
  ['198.51.100.7', '10:00:02', 'GET /v1/orders/48213 HTTP/1.1', 200, APP],
  ['192.0.2.14', '10:00:04', 'POST /v1/orders HTTP/1.1', 201, 'okhttp/4.12.0'],
  ['203.0.113.24', '10:00:05', 'GET /v1/reports/daily HTTP/1.1', 200, CH_WIN],
  ['198.51.100.31', '10:00:07', 'GET /v1/orders HTTP/1.1', 426, 'okhttp/3.14.9'],
  ['203.0.113.24', '10:00:09', 'GET /v1/reports/weekly HTTP/1.1', 200, CH_WIN],
  ['198.51.100.7', '10:00:11', 'GET /v1/orders HTTP/1.1', 200, APP],
].map(([ip, t, req, st, ua]) => `${ip} - - [01/Oct/2026:${t} +0000] "${req}" ${st} 512 "-" "${ua}" "-"`).join('\n') + '\n'
// Apache combined: UA is the last field
const apache = [
  ['203.0.113.40', 'GET /docs/ HTTP/1.1', 200, 'https://www.example.org/', CH_MAC],
  ['203.0.113.41', 'GET /docs/auth/ HTTP/1.1', 200, 'https://www.example.org/docs/', SAF_IOS],
  ['198.51.100.90', 'GET /robots.txt HTTP/1.1', 200, '-', 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  ['203.0.113.40', 'GET /docs/webhooks/ HTTP/1.1', 200, 'https://api.example.com/docs/', CH_MAC],
  ['192.0.2.200', 'GET /v1/status HTTP/1.1', 200, '-', 'curl/8.5.0'],
  ['203.0.113.42', 'GET /docs/ HTTP/1.1', 304, '-', SAF_IOS],
].map(([ip, req, st, ref, ua], i) => `${ip} - - [02/Oct/2026:14:2${i}:00 +0000] "${req}" ${st} 2048 "${ref}" "${ua}"`).join('\n') + '\n'
for (const s of [main, apache]) console.log(JSON.stringify(s))
