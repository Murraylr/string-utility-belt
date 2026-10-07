import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'extract-domains-from-urls',
  name: 'Extract the domain from a list of URLs',
  summary:
    'Paste a column of links and get each one’s hostname on the same line, lowercased and without www., whether or not the link starts with https://, so it pastes back beside its URL.',
  category: 'Data & Spreadsheets',
  primaryQuery: 'extract domain from url list',
  published: '2026-10-08',
  related: ['bulk-utm-link-builder'],
  steps: [
    each('host-each', { mode: 'lines' }, [
      laneStep('trim', 'trim'),
      laneStep('add-scheme', 'line_affix', { prefix: 'https://', suffix: '', skipBlank: true, joinWith: '' },
        { label: 'add https:// if missing', condition: { kind: 'regex', pattern: '^[a-z][a-z0-9+.-]*://', flags: 'i', negate: true } }),
      laneStep('parse', 'url_parse', { base: '', decodeParams: true }),
      laneStep('hostname', 'jsonpath', { path: '$.hostname', mode: 'first', indent: 2 }, { label: 'keep hostname' }),
    ],
      'Parses every line as a URL on its own and keeps only the hostname. A link copied without https:// gets it first, or the parser would read www.example.com/about as a path with no host.',
      { label: 'hostname of every URL' }),
    step('strip-www', 'replace', { pattern: '^www\\.', replacement: '', regex: true, flags: 'gm' },
      'Removes a leading www. from each hostname, so www.example.com and example.com count as the same site. Other subdomains such as shop. or blog. are kept.',
      { label: 'drop www.' }),
  ],
  samples: [
    {
      id: 'mixed-links',
      title: 'Links from a spreadsheet column',
      input: 'https://www.example.com/blog/spring-sale?utm_source=newsletter\nhttp://Shop.Example.org:8080/cart\nexample.net/about-us\nwww.example.com/contact\n\n  https://partner@api.example.com/v2/orders \n',
      output: `example.com
shop.example.org
example.net
example.com

api.example.com
`,
    },
    {
      id: 'ip-hosts',
      title: 'Server log referrers with IP hosts',
      input: 'http://192.0.2.10/admin/login\nhttps://[2001:db8::1]:8443/status\nhttps://cdn.example.com/assets/app.js\nhttps://www.example.org/\n',
      output: `192.0.2.10
[2001:db8::1]
cdn.example.com
example.org
`,
    },
  ],
}
