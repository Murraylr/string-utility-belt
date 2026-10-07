import { gzipSync } from 'node:zlib'
import { run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/decode-cloudwatch-logs-data/recipe'

const [data, gunzip, messages, lines] = ORIGINAL.steps
const variant = (lane: ReturnType<typeof laneStep>[]) => toPipelineSteps([
  data, gunzip, messages, lines,
  each('decode', { mode: 'lines' }, lane, 'x x x x x x'),
])
const NEW_NORMALIZE = variant([
  laneStep('unescape', 'code_string_unescape', { language: 'json' }),
  laneStep('final-newline', 'normalize_line_endings', { mode: 'lf', finalNewline: 'remove' }),
])
const NEW_REPLACE = variant([
  laneStep('unescape', 'code_string_unescape', { language: 'json' }),
  laneStep('final-newline', 'replace', { pattern: '[\\r\\n]+$', replacement: '', regex: true, flags: '' }),
])
const NO_TRIM = variant([laneStep('unescape', 'code_string_unescape', { language: 'json' })])
const OLD = toPipelineSteps(ORIGINAL.steps)

function event(msgs: string[]): string {
  const envelope = {
    messageType: 'DATA_MESSAGE', owner: '123456789012', logGroup: '/aws/lambda/edge-test', logStream: '2026/10/07/[$LATEST]abc',
    subscriptionFilters: ['all'],
    logEvents: msgs.map((m, i) => ({ id: String(38000000000000000000000000000000000000000000000000000000n + BigInt(i)), timestamp: 1791364462000 + i, message: m })),
  }
  return JSON.stringify({ awslogs: { data: gzipSync(Buffer.from(JSON.stringify(envelope))).toString('base64') } }, null, 2)
}

const cases: Record<string, string[]> = {
  'literal backslash-n at end': ['Splitting records on \\n', 'next event'],
  'literal backslash-r-n at end': ['Line terminator set to \\r\\n', 'next event'],
  'ends with a backslash': ['Wrote report to C:\\Reports\\', 'next event'],
  'CRLF message (.NET)': ['System.InvalidOperationException: boom\r\n   at Orders.Pay() in C:\\src\\Orders.cs:line 42\r\n', 'next event\r\n'],
  'empty message': ['first', '', 'third'],
  'indented continuation events (Java, one event per line)': ['java.lang.IllegalStateException: closed\n', '\tat com.example.Pool.get(Pool.java:88)\n', '    at com.example.Api.handle(Api.java:12)\n'],
  'trailing spaces and tab kept': ['REPORT RequestId: 1\tDuration: 2 ms\t\n', 'padded   \n'],
  'unicode and U+2028': ['Grüße aus Köln — ✓ 🚀\n', 'a\u2028b'],
  'control message': ['CWL CONTROL MESSAGE: Checking health of destination Firehose.'],
  'no events': [],
}

for (const [name, msgs] of Object.entries(cases)) {
  const input = event(msgs)
  const want = msgs.map(m => m.replace(/[\r\n]+$/, '')).join('\n')
  const o = await run(input, OLD)
  const n = await run(input, NEW_NORMALIZE)
  const r = await run(input, NEW_REPLACE)
  const t = await run(input, NO_TRIM)
  console.log(`\n### ${name}`)
  console.log('  expected       ', JSON.stringify(want))
  console.log('  main (sed)     ', JSON.stringify(o.out), Object.keys(o.errors).length ? o.errors : '', o.out === want ? 'OK' : 'WRONG')
  console.log('  each+normalize ', JSON.stringify(n.out), Object.keys(n.errors).length ? n.errors : '', n.out === want ? 'OK' : n.out === want.replace(/\r\n?/g, '\n') ? 'OK (CR→LF)' : 'WRONG')
  console.log('  each+replace   ', JSON.stringify(r.out), Object.keys(r.errors).length ? r.errors : '', r.out === want ? 'OK' : 'WRONG')
  console.log('  each, no trim  ', JSON.stringify(t.out), t.out === want ? 'OK' : 'differs')
}
