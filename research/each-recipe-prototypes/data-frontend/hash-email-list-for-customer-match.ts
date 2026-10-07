
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'hash-email-list-for-customer-match',
  name: 'Hash an email list for Customer Match',
  summary:
    'Paste a column of customer emails and get one SHA-256 hash per line, normalized the way Google Ads Customer Match expects, with blank cells kept so rows still line up.',
  category: 'Writing & Marketing',
  primaryQuery: 'hash emails for customer match',
  published: '2026-10-08',
  related: ['bulk-utm-link-builder'],
  steps: [
    step('spaces', 'replace', { pattern: '[^\\S\\r\\n]+', replacement: '', regex: true, flags: 'g' },
      'Deletes every space, tab and non-breaking space while keeping line breaks. Spreadsheet cells often carry a trailing space, and one stray space gives a completely different hash that never matches.',
      { label: 'remove spaces' }),
    step('lower', 'case', { mode: 'lower' },
      'Lowercases every address. SHA-256 is case-sensitive, and Google and Meta both lowercase before hashing, so Jane.Doe@Example.com must become jane.doe@example.com first.'),
    step('gmail-dots', 'replace', { pattern: '\\.(?=[^@\\s]*@(?:gmail|googlemail)\\.com$)', replacement: '', regex: true, flags: 'gm' },
      'Google asks for dots before the @ to be removed in gmail.com and googlemail.com addresses, since Gmail ignores them. Dots in every other domain are kept, because there they change the mailbox.',
      { label: 'drop Gmail dots' }),
    each('hash-each', { mode: 'lines' }, [laneStep('sha256', 'hash', { algo: 'SHA-256' })],
      'Hashes each line on its own into 64 lowercase hex characters. The hash utility digests its whole input as one value, so without this step the list would collapse into a single hash.',
      { label: 'SHA-256 every line' }),
  ],
  samples: [
    {
      id: 'crm-export',
      title: 'CRM export column',
      input: ' Jane.Doe@Example.com \nj.smith.84@gmail.com\n\nALEX.RIVERA@GoogleMail.com\u00a0\nsupport.team@example.org\n',
      output: `86e0b9e56c17cc4d12387e1949b85053fbe73bc3ce5a1188713a9d300cc6133d
82234fd011a700871151233b13ed254e4d957f86593149137c49c6c926e696ad

d63b7cbbcc312861619bd507dccd1588632340511d5b96a35ec6a22052bdaa39
884c53e13ea0e5f65527b2d45b1cdb6909d338c096da039fc7233af1a88b8b01
`,
    },
    {
      id: 'meta-test-vector',
      title: "Meta's documented example",
      input: 'John_Smith@gmail.com\n',
      output: `62a14e44f765419d10fea99367361a727c12365e2520f32218d505ed9aa0f62f
`,
    },
  ],
}

