/** Writes the full draft recipe files for the bulk-utm-link-builder and excel-column-to-sql-in-clause refactors. */
import { readFileSync, writeFileSync } from 'node:fs'

const OUT = '/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/refactors'
const read = (slug: string) => readFileSync(`/home/user/string-utility-belt/src/recipes/${slug}/recipe.ts`, 'utf8')
function must(src: string, re: RegExp, to: string): string {
  if (!re.test(src)) throw new Error(`no match: ${re}`)
  return src.replace(re, to)
}
const absImports = (src: string, names: string) => must(src,
  /import type \{ Recipe \} from '\.\.\/types'\nimport \{ [^}]+ \} from '\.\.\/define'\n/,
  `import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'\nimport { ${names} } from '/home/user/string-utility-belt/src/recipes/define'\n`)
const updated = (src: string) => must(src, /  published: '2026-10-07',\n/, "  published: '2026-10-07',\n  updated: '2026-10-08',\n")

// ---- bulk-utm-link-builder: the STRIP sed script becomes a per-link "run on each" -------------
let utm = absImports(read('bulk-utm-link-builder'), 'each, laneStep, step')
utm = must(utm, /\/\*\* Step 2:[\s\S]*?\]\.join\('\\n'\)\n\n/, '')
utm = updated(utm)
utm = must(utm, /    step\('strip', 'sed', \{ script: STRIP, perLine: true \},\n[\s\S]*?\{ label: 'remove old utm_ tags' \}\),\n/,
`    each('strip', { mode: 'lines' }, [
      laneStep('amp', 'unescape_html', {}, { label: 'turn &amp; back into &' }),
      laneStep('drop-utm', 'query_params_normalize', {
        sort: false, dedupe: 'none', dropEmpty: false, drop: 'utm_*', decode: false, lowercaseHost: false,
      }, { label: 'drop utm_* parameters' }),
    ],
    'Cleans one link at a time: turns the &amp; of HTML source back into &, then drops every query parameter matching utm_*, in any capitalization, with the ? or & it leaves behind. Add fbclid or gclid to the drop list to strip those too. Otherwise a reused link carries two utm_source values.',
    { label: 'remove old utm_ tags' }),
`)
writeFileSync(`${OUT}/bulk-utm-link-builder.recipe.ts`, utm)

// ---- excel-column-to-sql-in-clause: escape and quote each value on its own ---------------------
let xl = absImports(read('excel-column-to-sql-in-clause'), 'each, laneStep, step')
xl = updated(xl)
xl = must(xl, /    step\('escape', 'sql_escape'[\s\S]*?\{ label: 'quote and join values' \}\),\n/,
`    each('quote', { mode: 'lines' }, [laneStep('escape', 'sql_escape', { flavor: 'ansi', wrap: true })],
      "Turns each value into a SQL string literal on its own: doubles every apostrophe, so O'Connor stays one value, and wraps it in single quotes. Switch the flavor to mysql for MySQL and MariaDB backslash escapes, or mssql for an N prefix on non-ASCII names.",
      { label: 'quote each value' }),
    step('join', 'line_affix', { prefix: '', suffix: '', skipBlank: true, joinWith: ', ' },
      'Joins the quoted values with commas onto one line, skipping the blank cells between rows, which have nothing to quote.',
      { label: 'join with commas' }),
`)
xl = must(xl, /'Paste a column copied from Excel or Google Sheets and get a ready-to-run IN \(…\) list: whitespace trimmed, duplicates dropped, apostrophes escaped and every value quoted\.'/,
  "'Paste a column copied from Excel or Google Sheets and get a ready-to-run IN (…) list: whitespace trimmed, duplicates dropped, and every value escaped and quoted for your SQL dialect.'")
writeFileSync(`${OUT}/excel-column-to-sql-in-clause.recipe.ts`, xl)
console.log('wrote 2 drafts')
