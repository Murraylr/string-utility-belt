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
    each('escape-each', { mode: 'lines' }, [laneStep('trim', 'trim'), laneStep('escape', 'json_escape')],
      'Trims each line and escapes it on its own, so a stray trailing space is dropped, a double quote becomes \\" and a backslash or tab gets its JSON escape. Escaping the whole list at once would turn every line break into \\n and fuse the list into one string.',
      { label: 'escape every value' }),
    step('quote', 'line_affix', { prefix: '"', suffix: '"', skipBlank: true, joinWith: ', ' },
      'Wraps each value in double quotes and joins them with commas, skipping blank lines so an empty cell does not become an empty string.',
      { label: 'quote and join values' }),
    step('wrap', 'line_affix', { prefix: '[', suffix: ']', skipBlank: true, joinWith: '' },
      'Adds the square brackets that make the comma-separated strings one JSON array.',
      { label: 'wrap in [ … ]' }),
    step('pretty', 'json_pretty', { indent: 2 },
      'Prints one value per line with two-space indentation, ready for a .json file or a JavaScript constant. It parses the array to do so, which also proves the result is valid JSON.'),
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
