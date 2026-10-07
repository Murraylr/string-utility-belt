import { each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'add-leading-zeros-to-zip-codes',
  name: 'Add leading zeros back to ZIP codes',
  summary:
    'Paste a ZIP code column that Excel or a CSV import turned into numbers and get 02134 back from 2134 and 021341234 from 21341234, with headers, hyphenated codes and blank cells left alone.',
  category: 'Data & Spreadsheets',
  primaryQuery: 'add leading zeros to zip codes',
  published: '2026-10-08',
  related: ['excel-column-to-sql-in-clause'],
  steps: [
    each('pad-each', { mode: 'lines' }, [
      laneStep('zip5', 'pad', { length: 5, char: '0', side: 'start' }, { condition: { kind: 'regex', pattern: '^\\d{3,4}$' } }),
      laneStep('zip9', 'pad', { length: 9, char: '0', side: 'start' }, { condition: { kind: 'regex', pattern: '^\\d{7,8}$' } }),
    ],
      'Pads each line on its own: three or four digits become a five-digit ZIP, seven or eight become a nine-digit ZIP+4. Headers, codes with a hyphen and blank cells match neither pattern and stay as they are.',
      { label: 'pad every code' }),
  ],
  samples: [
    {
      id: 'excel-zip-column',
      title: 'ZIP column copied from Excel',
      input: 'Zip\n2134\n501\n90210\n7030\n\n6103\n02134-1234\n10001\n',
      output: 'Zip\n02134\n00501\n90210\n07030\n\n06103\n02134-1234\n10001\n',
    },
    {
      id: 'county-fips',
      title: 'County FIPS codes from a CSV',
      input: 'fips\n1001\n6037\n36061\n2020\n9003\n72127\n',
      output: 'fips\n01001\n06037\n36061\n02020\n09003\n72127\n',
    },
    {
      id: 'zip-plus-four',
      title: 'ZIP+4 without the hyphen',
      input: '21341234\n5010001\n902101234\n70306404\n',
      output: '021341234\n005010001\n902101234\n070306404\n',
    },
  ],
}
