import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'parse-user-agent-list-to-csv',
  name: 'Parse a list of user agents into a CSV',
  summary:
    'Paste user-agent strings from a log or analytics export, one per line, and get a CSV with browser, version, OS, device type and a bot flag for each, ready for a spreadsheet.',
  category: 'Data & Spreadsheets',
  primaryQuery: 'parse list of user agents',
  published: '2026-10-08',
  related: ['nested-json-to-csv'],
  steps: [
    each('parse-each', { mode: 'lines' }, [laneStep('ua', 'user_agent_parse')],
      'Parses each line as its own user-agent string with ua-parser-js and writes the result as one line of JSON. Parsing the whole paste at once would read every line as a single, nonsensical user agent.',
      { label: 'parse every user agent', includeEmpty: true }),
    step('to-array', 'jsonl_to_json', { indent: 2, skipBlank: true, onError: 'error' },
      'Collects the one-JSON-object-per-line output into a single JSON array, the shape the CSV converter reads.',
      { label: 'collect into an array' }),
    step('to-csv', 'json_to_csv', { delimiter: ',', header: true, flatten: true, eol: 'lf', columns: 'browser.name,browser.major,os.name,os.version,device.type,isBot' },
      'Flattens the nested browser, os and device objects into dotted column names and keeps only the six columns most reports need, with a header row. Engine and CPU details are dropped.',
      { label: 'pick columns as CSV' }),
  ],
  samples: [
    {
      id: 'access-log-agents',
      title: 'User agents from an access log',
      input: [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
        'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0',
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      ].join('\n') + '\n',
      output: `browser.name,browser.major,os.name,os.version,device.type,isBot
Chrome,129,Windows,10,desktop,false
Mobile Safari,17,iOS,17.6,mobile,false
Safari,17,macOS,10.15.7,desktop,false
Mobile Chrome,129,Android,10,mobile,false
Edge,129,Windows,10,desktop,false
Googlebot,2,,,,true`,
    },
    {
      id: 'api-clients',
      title: 'API clients with a blank row',
      input: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0\n\ncurl/8.5.0\npython-requests/2.32.3\n',
      output: `browser.name,browser.major,os.name,os.version,device.type,isBot
Firefox,130,Ubuntu,,desktop,false
,,,,,false
curl,8,,,,true
python-requests,2,,,,true`,
    },
  ],
}
