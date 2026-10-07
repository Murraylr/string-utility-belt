import { run } from "../../harness"
import { recipe } from "./ua-def"
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
const CH = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const cases: Record<string, string> = {
  // nginx.org package / official Docker image default: log_format main ... "$http_user_agent" "$http_x_forwarded_for"
  nginxMain: `198.51.100.23 - - [07/Oct/2026:09:12:01 +0000] "GET / HTTP/1.1" 200 615 "-" "${CH}" "-"\n203.0.113.5 - - [07/Oct/2026:09:12:04 +0000] "GET / HTTP/1.1" 200 615 "-" "curl/8.7.1" "192.0.2.4"\n`,
  // Apache escapes a quote inside the UA as \"
  apacheEscaped: `198.51.100.23 - - [07/Oct/2026:09:12:01 +0000] "GET / HTTP/1.1" 200 615 "-" "Mozilla/5.0 (compatible; \\"Foo\\" Bot/1.0)"\n`,
  // nginx escapes as \\x22
  nginxEscaped: `198.51.100.23 - - [07/Oct/2026:09:12:01 +0000] "GET / HTTP/1.1" 200 615 "-" "Mozilla/5.0 \\x22test\\x22"\n`,
  // Common log format (no UA)
  common: `198.51.100.23 - - [07/Oct/2026:09:12:01 +0000] "GET / HTTP/1.1" 200 615\n`,
  // Cubot phone (vendor model containing bot)
  cubot: 'Mozilla/5.0 (Linux; Android 10; CUBOT X30) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36\n',
  // Header row of a CSV export
  csvHeader: 'user_agent\n"' + CH + '"\n',
  // CSV row with several columns
  csvRow: '2026-10-07,198.51.100.23,"' + CH + '"\n',
  // HTML-escaped UA
  htmlEsc: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 &amp; foo\n',
  // UA with a comma -> CSV quoting? (browser.name no commas, check anyway)
  long: CH + ' ' + 'x'.repeat(20000) + '\n',
  // IPv6 + combined
  v6: `2001:db8::1 - - [07/Oct/2026:09:12:01 +0000] "GET / HTTP/1.1" 200 615 "https://example.com/?q=a\\"b" "${CH}"\n`,
  // TSV with UA last column (e.g. from BigQuery / Athena)
  tsv: `198.51.100.23\t${CH}\n`,
  // Traefik / Caddy JSON access log line
  caddyJson: `{"level":"info","ts":1759828321.1,"request":{"remote_ip":"198.51.100.23","headers":{"User-Agent":["${CH}"]}},"status":200}\n`,
  // whitespace-only line with includeEmpty
  ws: '   \n' + CH + '\n',
}
for (const [k, input] of Object.entries(cases)) {
  const r = await run(input, steps)
  console.log(`--- ${k} ${Object.keys(r.errors).length ? 'ERR ' + JSON.stringify(r.errors) : ''}\n${r.out.slice(0, 600)}`)
}
