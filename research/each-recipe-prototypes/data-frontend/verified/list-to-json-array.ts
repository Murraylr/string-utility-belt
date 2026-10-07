import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'

export const recipe: Recipe = {
  slug: 'list-to-json-array',
  name: 'Convert a list to a JSON array',
  summary:
    'Paste one value per line, from a spreadsheet column or a text file, and get a valid JSON array of strings with quotes, backslashes and tabs escaped and blank lines left out.',
  category: 'Frontend',
  primaryQuery: 'convert list to json array',
  published: '2026-10-08',
  related: ['excel-column-to-sql-in-clause', 'unescape-stringified-json'],
  steps: [
    each('quote-each', { mode: 'lines' }, [
      laneStep('trim', 'trim'),
      laneStep('quote', 'code_string_escape', { language: 'json', quote: 'double', wrap: true, escapeNonAscii: false },
        { label: 'JSON string', condition: { kind: 'nonEmpty' } }),
    ],
      'Trims each line and turns it into a JSON string literal on its own: a double quote becomes \\", a backslash \\\\ and a tab \\t. Escaping the whole list at once would turn every line break into \\n and fuse the list into one string.',
      { label: 'quote every value' }),
    step('collect', 'jsonl_to_json', { indent: 2, skipBlank: true, onError: 'error' },
      'Reads the one-string-per-line result as JSON Lines and collects it into a single array, two-space indented, skipping blank lines so an empty cell does not become an empty string. Parsing every line also proves the result is valid JSON.',
      { label: 'collect into [ … ]' }),
  ],
  samples: [
    {
      id: 'menu-labels',
      title: 'Menu labels from a spreadsheet',
      input: 'Home\nNew Arrivals \nThe "Weekend" Sale\n\nGift Cards\nCafé & Bakery\n',
      output: "[\n  \"Home\",\n  \"New Arrivals\",\n  \"The \\\"Weekend\\\" Sale\",\n  \"Gift Cards\",\n  \"Café & Bakery\"\n]",
    },
    {
      id: 'windows-paths',
      title: 'Windows file paths',
      input: 'C:\\Reports\\2026\\q3-summary.xlsx\r\nD:\\Exports\\customers.csv\r\n\\\\fileserver\\shared\\logo.png\r\n',
      output: "[\n  \"C:\\\\Reports\\\\2026\\\\q3-summary.xlsx\",\n  \"D:\\\\Exports\\\\customers.csv\",\n  \"\\\\\\\\fileserver\\\\shared\\\\logo.png\"\n]",
    },
  ],
}
