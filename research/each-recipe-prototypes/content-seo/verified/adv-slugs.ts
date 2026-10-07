import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import(process.env.DRAFT!)
const steps = toPipelineSteps(recipe.steps)
const show = async (label: string, input: string) => {
  const r = await run(input, steps)
  console.log(`# ${label}\n   ${JSON.stringify(input)}\n=> ${JSON.stringify(r.out)}${Object.keys(r.errors).length ? '  ERR ' + JSON.stringify(r.errors) : ''}`)
}
console.log('\n================ ADVERSARIAL')
await show('WP export entities', 'Don&#8217;t Miss These Tips &amp; Tricks\nThe &#8220;Best&#8221; Guide')
await show('ligatures from PDF', 'Oﬃce Workﬂow: ﬁnd and ﬁx')
await show('symbols', 'Example™ Pro © 2026 – ½ Price')
await show('numbers with commas/decimals', '1,000 Ways to Save $1,500\nVersion 2.0.1 Release Notes')
await show('acronyms with &', 'AT&T vs T-Mobile\nQ&A: R&D Budget')
await show('duplicates', 'Hello World\nHello, World!\nhello world')
await show('TSV two columns', '101\tSummer Sale\n102\tWinter Sale')
await show('NBSP and tabs', 'Summer Sale Now\tOpen')
await show('dotless i & capital I', 'IDEAS for Istanbul\nıssız ada')
await show('Cyrillic mixed', 'Москва Travel Guide 2026')
await show('German umlauts (WP gives ae/oe/ue only in de locale)', 'Müller über Größe')
await show('leading/trailing punctuation', '  — "Quoted Title" —  \n...and more...')
await show('only stopwords/long', 'A Guide to the Best of the Best in the World of the Web')
await show('spreadsheet with header and CRLF', 'Title\r\nFirst Post\r\nSecond Post\r\n')
