import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'

const recipe: Recipe = {
  slug: 'user-agent-breakdown-from-access-log',
  name: 'Count the clients in an access log by user agent',
  summary:
    'Paste an nginx or Apache access log and get each client with its request count: browsers and bots collapsed to name, version and OS, libraries and app user agents kept as written.',
  category: 'Web & APIs',
  primaryQuery: 'user agent breakdown from access log',
  published: '2026-10-08',
  steps: [
    step('take-ua', 'sed', { script: 's/^[^"]*"[^"]*"[^"]*"[^"]*"[^"]*"([^"]*)".*$/\\1/', perLine: true },
      'Keeps the third quoted field of each line, the user agent in the combined log format, whether or not nginx adds a quoted X-Forwarded-For field after it as its default main format does.',
      { label: 'keep the user agent' }),
    each('name-clients', { mode: 'lines' }, [
      laneStep('parse', 'user_agent_parse', {}, { condition: { kind: 'regex', pattern: '^Mozilla/' } }),
      laneStep('one-line', 'json_to_csv', { header: false, flatten: true, columns: 'browser.name,browser.major,os.name', delimiter: ' / ' }, { condition: { kind: 'regex', pattern: '^\\{' } }),
    ],
      'Parses only user agents starting with Mozilla/, the long browser and crawler strings, and writes each as browser, major version and OS on one line. Short library and app agents such as okhttp/4.12.0 already say who they are, so they stay as written.',
      { label: 'name each client' }),
    step('count', 'uniq_count', { sort: 'count-desc', trim: true },
      'Counts identical lines and lists the busiest client first, so a version that should have been retired, or a crawler you did not expect, stands out at the top.',
      { label: 'count per client' }),
  ],
  samples: [
    { id: 'nginx-main', title: 'nginx main format (API traffic)', input: "192.0.2.14 - - [01/Oct/2026:10:00:01 +0000] \"GET /v1/orders HTTP/1.1\" 200 512 \"-\" \"okhttp/4.12.0\" \"-\"\n198.51.100.7 - - [01/Oct/2026:10:00:02 +0000] \"GET /v1/orders/48213 HTTP/1.1\" 200 512 \"-\" \"OrdersApp/3.2.1 (iPhone; iOS 18.6; Scale/3.00)\" \"-\"\n192.0.2.14 - - [01/Oct/2026:10:00:04 +0000] \"POST /v1/orders HTTP/1.1\" 201 512 \"-\" \"okhttp/4.12.0\" \"-\"\n203.0.113.24 - - [01/Oct/2026:10:00:05 +0000] \"GET /v1/reports/daily HTTP/1.1\" 200 512 \"-\" \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36\" \"-\"\n198.51.100.31 - - [01/Oct/2026:10:00:07 +0000] \"GET /v1/orders HTTP/1.1\" 426 512 \"-\" \"okhttp/3.14.9\" \"-\"\n203.0.113.24 - - [01/Oct/2026:10:00:09 +0000] \"GET /v1/reports/weekly HTTP/1.1\" 200 512 \"-\" \"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36\" \"-\"\n198.51.100.7 - - [01/Oct/2026:10:00:11 +0000] \"GET /v1/orders HTTP/1.1\" 200 512 \"-\" \"OrdersApp/3.2.1 (iPhone; iOS 18.6; Scale/3.00)\" \"-\"\n", output: "2\tokhttp/4.12.0\n2\tOrdersApp/3.2.1 (iPhone; iOS 18.6; Scale/3.00)\n2\tChrome / 141 / Windows\n1\tokhttp/3.14.9",
    },
    { id: 'apache-combined', title: 'Apache combined (docs site)', input: "203.0.113.40 - - [02/Oct/2026:14:20:00 +0000] \"GET /docs/ HTTP/1.1\" 200 2048 \"https://www.example.org/\" \"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36\"\n203.0.113.41 - - [02/Oct/2026:14:21:00 +0000] \"GET /docs/auth/ HTTP/1.1\" 200 2048 \"https://www.example.org/docs/\" \"Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1\"\n198.51.100.90 - - [02/Oct/2026:14:22:00 +0000] \"GET /robots.txt HTTP/1.1\" 200 2048 \"-\" \"Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)\"\n203.0.113.40 - - [02/Oct/2026:14:23:00 +0000] \"GET /docs/webhooks/ HTTP/1.1\" 200 2048 \"https://api.example.com/docs/\" \"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36\"\n192.0.2.200 - - [02/Oct/2026:14:24:00 +0000] \"GET /v1/status HTTP/1.1\" 200 2048 \"-\" \"curl/8.5.0\"\n203.0.113.42 - - [02/Oct/2026:14:25:00 +0000] \"GET /docs/ HTTP/1.1\" 304 2048 \"-\" \"Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1\"\n", output: "2\tChrome / 141 / macOS\n2\tMobile Safari / 18 / iOS\n1\tbingbot / 2 /\n1\tcurl/8.5.0",
    },
  ],
}
export default recipe
