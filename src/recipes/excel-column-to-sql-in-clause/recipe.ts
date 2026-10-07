import type { Recipe } from '../types'
import { step } from '../define'

const recipe: Recipe = {
  slug: 'excel-column-to-sql-in-clause',
  name: 'Turn an Excel column into a SQL IN clause',
  summary:
    'Paste a column copied from Excel or Google Sheets and get a ready-to-run IN (…) list: whitespace trimmed, duplicates dropped, apostrophes escaped and every value quoted.',
  category: 'Data & Spreadsheets',
  primaryQuery: 'excel column to sql in clause',
  published: '2026-10-07',
  steps: [
    step('trim', 'trim_lines', { side: 'both', characters: '' },
      'Cells copied from a spreadsheet often carry leading or trailing spaces, tabs or non-breaking spaces, which would end up inside the quotes.'),
    step('dedupe', 'line_dedupe', { caseSensitive: true },
      'Repeated values make the list longer without changing the result. Exact matches only, so values that differ in case stay distinct.'),
    step('escape', 'sql_escape', { flavor: 'ansi', wrap: false },
      "Doubles every apostrophe, so a value like O'Connor cannot end the string early and break (or inject into) the query."),
    step('quote', 'line_affix', { prefix: "'", suffix: "'", skipBlank: true, joinWith: ', ' },
      'Wraps each value in single quotes and joins them with commas, skipping the blank cells between rows.'),
    step('wrap', 'line_affix', { prefix: 'IN (', suffix: ')', skipBlank: true, joinWith: '' },
      'Adds the IN ( … ) around the list, so the result pastes straight after WHERE column_name in your query.'),
  ],
  samples: [
    {
      id: 'email-column',
      title: 'Email column',
      input: "  dana.whitfield@northwind.com\nmarcus.oneil@contoso.com\n\nPriya.Raman@fabrikam.io \ndana.whitfield@northwind.com\nsean.o'connor@adventure-works.com\n\tleo.martins@contoso.com\nmarcus.oneil@contoso.com\n",
      output: "IN ('dana.whitfield@northwind.com', 'marcus.oneil@contoso.com', 'Priya.Raman@fabrikam.io', 'sean.o''connor@adventure-works.com', 'leo.martins@contoso.com')",
    },
    {
      id: 'windows-copy',
      title: 'SKUs copied on Windows',
      input: 'SKU-1001\r\nSKU-1002 \r\nSKU-1001\r\nSKU-2040\r\n',
      output: "IN ('SKU-1001', 'SKU-1002', 'SKU-2040')",
    },
    {
      id: 'customer-names',
      title: 'Names with apostrophes',
      input: "O'Brien\nD'Angelo\nO'Brien\nMcAllister\n",
      output: "IN ('O''Brien', 'D''Angelo', 'McAllister')",
    },
  ],
}
export default recipe
