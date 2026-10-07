import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const { recipe } = await import('/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/content-seo/line-lengths.ts')
const steps: any[] = JSON.parse(JSON.stringify(toPipelineSteps(recipe.steps)))
steps[0].steps[0].merge = { mode: 'concat', separator: '\t' }
for (const align of ['auto', 'right']) {
  const s2 = [...steps, { id: 'al', utilityId: 'align_columns', enabled: true, params: { delimiter: '\t', outputDelimiter: '  ', align } }]
  for (const smp of recipe.samples) console.log(`ALIGN ${align} ${smp.id}\n` + JSON.stringify((await run(smp.input, s2)).out).replace(/\\n/g, '\n'))
}
const s3 = [...steps, { id: 'al', utilityId: 'align_columns', enabled: true, params: { delimiter: '\t', outputDelimiter: '  ', align: 'auto' } }]
for (const [label, input] of [
  ['CRLF + blank + trailing', 'One\r\n\r\nTwo words\r\n'],
  ['whitespace-only + padded', 'a\n   \n  padded  '],
  ['tab inside a line', 'Title\thttps://example.com/\nShort'],
  ['emoji/CJK', '👩‍👩‍👧 Family\n東京の天気\nok'],
  ['empty', ''],
  ['1200-char line', 'x'.repeat(1200) + '\nshort'],
] as const) console.log(`EDGE ${label}\n   ` + JSON.stringify((await run(input, s3)).out).slice(0, 200))
