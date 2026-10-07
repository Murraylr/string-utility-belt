import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

/** combined-format line (any prefix before [time], any fields after the UA), or a UA wrapped in quotes */
export const UA_FIELD = String.raw`^(?:.*?\[[^\]]*\] "(?:[^"\\]|\\.)*" \d{3} \S+ "(?:[^"\\]|\\.)*" "((?:[^"\\]|\\.)*)".*|"([^"]*)"[ \t]*)$`

const COLUMNS = 'browser.name,browser.version,os.name,os.version,device.type,device.vendor,device.model,isBot'

const LOG = [
  '198.51.100.23 - - [07/Oct/2026:09:12:01 +0000] "GET /pricing HTTP/2.0" 200 18234 "https://www.example.com/blog/build-a-slack-bot/" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"',
  '203.0.113.5 - - [07/Oct/2026:09:12:04 +0000] "GET / HTTP/2.0" 200 5120 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1"',
  '192.0.2.77 - - [07/Oct/2026:09:12:09 +0000] "GET /docs/ HTTP/2.0" 200 9921 "https://www.example.org/" "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"',
  '198.51.100.41 - - [07/Oct/2026:09:12:15 +0000] "GET /pricing HTTP/2.0" 200 18234 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.2739.42"',
  '203.0.113.88 - - [07/Oct/2026:09:12:20 +0000] "GET /blog/ HTTP/2.0" 200 7310 "https://duckduckgo.com/" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:130.0) Gecko/20100101 Firefox/130.0"',
  '192.0.2.150 - - [07/Oct/2026:09:12:31 +0000] "GET /robots.txt HTTP/1.1" 200 68 "-" "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"',
  '198.51.100.9 - - [07/Oct/2026:09:12:40 +0000] "HEAD /health HTTP/1.1" 200 0 "-" "curl/8.7.1"',
].join('\n') + '\n'

export const recipe: Recipe = {
  slug: 'parse-user-agents-from-access-log',
  name: 'Parse user agents from an access log into a CSV',
  summary:
    'Paste nginx or Apache access log lines, or a column of user-agent strings, and get a CSV row per line with the browser, OS, device and a bot flag.',
  category: 'Web & APIs',
  primaryQuery: 'parse user agents from access log',
  published: '2026-10-08',
  related: ['nested-json-to-csv'],
  steps: [
    step('ua-field', 'replace', { pattern: UA_FIELD, replacement: '$1$2', regex: true, flags: 'gm' },
      'In the combined log format the user agent is the quoted field after the request, status, size and referrer. This keeps only that field, so a referrer URL or a trailing forwarded-for field cannot be read as the browser.',
      { label: 'keep the user-agent field' }),
    each('parse-each', { mode: 'lines' }, [laneStep('ua', 'user_agent_parse')],
      'The user agent parser reads one string and returns one JSON object. Running it on each line gives every request its own result, written back as one compact JSON line.',
      { label: 'parse every line', includeEmpty: true }),
    step('collect', 'jsonl_to_json', { indent: 2, skipBlank: true, onError: 'error' },
      'The results arrive as JSON Lines, one object per line. This collects them into a single JSON array, the shape the CSV step expects.',
      { label: 'collect into an array' }),
    step('csv', 'json_to_csv', { delimiter: ',', header: true, flatten: true, eol: 'lf', columns: COLUMNS },
      'Flattens the nested browser, os and device objects into dotted column names and keeps the eight columns worth reading, with a header row and one row per input line.',
      { label: 'pick columns as CSV' }),
  ],
  samples: [
    { id: 'nginx-access-log', title: 'nginx access log lines', input: LOG, output: 'browser.name,browser.version,os.name,os.version,device.type,device.vendor,device.model,isBot\nChrome,128.0.0.0,Windows,10,desktop,,,false\nMobile Safari,17.6,iOS,17.6,mobile,Apple,iPhone,false\nMobile Chrome,128.0.0.0,Android,10,mobile,,K,false\nEdge,128.0.2739.42,Windows,10,desktop,,,false\nFirefox,130.0,macOS,10.15,desktop,Apple,Macintosh,false\nGooglebot,2.1,,,,,,true\ncurl,8.7.1,,,,,,true' },
    {
      id: 'nginx-main-format',
      title: 'nginx main format (Docker image default)',
      input: [
        '203.0.113.14 - - [07/Oct/2026:10:01:07 +0000] "GET /metrics HTTP/1.1" 200 5120 "-" "Go-http-client/1.1" "-"',
        '198.51.100.62 - - [07/Oct/2026:10:01:09 +0000] "GET /checkout HTTP/1.1" 200 4412 "https://www.example.com/cart" "Mozilla/5.0 (iPad; CPU OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1" "192.0.2.201"',
        '192.0.2.18 - - [07/Oct/2026:10:01:12 +0000] "GET /sitemap.xml HTTP/1.1" 200 1840 "-" "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)" "-"',
      ].join('\n') + '\n',
      output: 'browser.name,browser.version,os.name,os.version,device.type,device.vendor,device.model,isBot\nGo-http-client,1.1,,,,,,true\nMobile Safari,17.6,iOS,17.6,tablet,Apple,iPad,false\nbingbot,2.0,,,,,,true',
    },
    {
      id: 'spreadsheet-column',
      title: 'User-agent column with gaps',
      input: [
        'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
        '',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
        'Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
        '-',
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
        'python-requests/2.32.3',
      ].join('\r\n') + '\r\n',
      output: 'browser.name,browser.version,os.name,os.version,device.type,device.vendor,device.model,isBot\nFirefox,130.0,Linux,,desktop,,,false\n,,,,,,,false\nSafari,17.6,macOS,10.15.7,desktop,Apple,Macintosh,false\nSamsung Internet,25.0,Android,14,mobile,Samsung,SM-S921B,false\n,,,,,,,false\nbingbot,2.0,,,,,,true\npython-requests,2.32.3,,,,,,true',
    },
  ],
}
