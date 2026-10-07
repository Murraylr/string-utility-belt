import { gzipSync } from 'node:zlib'
import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/decode-cloudwatch-logs-data/recipe'
import DRAFT from '../decode-cloudwatch-logs-data.recipe'

const OLD = toPipelineSteps(ORIGINAL.steps), NEW = toPipelineSteps(DRAFT.steps)
const env = (msgs: string[], type = 'DATA_MESSAGE') => ({
  messageType: type, owner: '123456789012', logGroup: '/aws/lambda/edge', logStream: '2026/10/07/[$LATEST]abc', subscriptionFilters: ['all'],
  logEvents: msgs.map((m, i) => ({ id: String(38000000000000000000000000000000000000000000000000000000n + BigInt(i)), timestamp: 1791364462000 + i, message: m })),
})
const gz = (o: unknown) => gzipSync(Buffer.from(JSON.stringify(o))).toString('base64')
const lambda = (msgs: string[]) => JSON.stringify({ awslogs: { data: gz(env(msgs)) } }, null, 2)

async function cmp(name: string, input: string) {
  const t0 = performance.now(); const n = await run(input, NEW); const t1 = performance.now(); const o = await run(input, OLD); const t2 = performance.now()
  console.log(`\n### ${name}  (draft ${(t1 - t0).toFixed(0)}ms, main ${(t2 - t1).toFixed(0)}ms)`)
  const show = (s: string) => JSON.stringify(s.length > 400 ? s.slice(0, 400) + '…[' + s.length + ']' : s)
  console.log('  draft', show(n.out), Object.keys(n.errors).length ? JSON.stringify(n.errors).slice(0, 300) : '')
  console.log('  main ', show(o.out), Object.keys(o.errors).length ? JSON.stringify(o.errors).slice(0, 300) : '')
  console.log('  same?', n.out === o.out)
}

// Firehose data-transformation event, 3 records
await cmp('firehose 3 records', JSON.stringify({ invocationId: 'a1b2', deliveryStreamArn: 'arn:aws:firehose:us-east-1:123456789012:deliverystream/logs', region: 'us-east-1',
  records: [1, 2, 3].map(i => ({ recordId: `4965${i}`, approximateArrivalTimestamp: 1791364462000, data: gz(env([`event ${i}a\n`, `event ${i}b\n`])) })) }, null, 2))
// Lambda JSON log format
await cmp('lambda JSON log format', lambda(['{"timestamp":"2026-10-07T09:14:22.120Z","level":"ERROR","message":"Payment declined","requestId":"5f0c"}', '{"time":"2026-10-07T09:14:22.128Z","type":"platform.report","record":{"requestId":"5f0c","metrics":{"durationMs":271.45}}}']))
// message only a newline, message ending in two newlines, lone CR progress
await cmp('only-newline / double newline / lone CR', lambda(['first\n', '\n', 'second\n\n', 'progress 10%\rprogress 100%\n', 'last']))
// quoted messages
await cmp('messages wrapped in quotes', lambda(['"quoted"\n', "'single'\n", '`tick`']))
// CRLF pretty-printed input
await cmp('CRLF pasted event', lambda(['hello\n', 'world\n']).replace(/\n/g, '\r\n'))
// two bare values on two lines
await cmp('two bare values', gz(env(['a\n'])) + '\n' + gz(env(['b\n'])) + '\n')
// bare value in quotes
await cmp('bare value in quotes', `"${gz(env(['quoted bare\n']))}"`)
// bare value wrapped at 76 cols
await cmp('bare wrapped 76', gz(env(['wrapped\n'])).replace(/(.{76})/g, '$1\n'))
// batch: valid + truncated
const good = gz(env(['ok one\n', 'ok two\n']))
const bad = gz(env(['will be cut\n'])).slice(0, 40)
await cmp('kinesis: valid + truncated record', JSON.stringify({ Records: [{ kinesis: { data: good } }, { kinesis: { data: bad } }] }, null, 2))
await cmp('kinesis: truncated + valid record', JSON.stringify({ Records: [{ kinesis: { data: bad } }, { kinesis: { data: good } }] }, null, 2))
// batch: control message + data
await cmp('control + data', JSON.stringify({ Records: [{ kinesis: { data: gz(env(['CWL CONTROL MESSAGE: Checking health of destination Kinesis stream.'], 'CONTROL_MESSAGE')) } }, { kinesis: { data: good } }] }, null, 2))
// batch where a record is gzipped but not CWL (gzipped NDJSON from another producer)
await cmp('foreign gzip record', JSON.stringify({ Records: [{ kinesis: { data: gzipSync(Buffer.from('{"a":1}\n{"a":2}\n')).toString('base64') } }, { kinesis: { data: good } }] }, null, 2))
// pretty JSON with no payload
await cmp('pretty JSON without payload', JSON.stringify({ Records: [{ kinesis: { data: 'eyJhIjoxfQ==' } }] }, null, 2))
// Python repr
await cmp('python repr', `{'awslogs': {'data': '${good}'}}`)
// Node console.log with timestamp prefix
await cmp('lambda log line with prefix', `2026-10-07T09:14:22.120Z\t5f0c\tINFO\t{ awslogs: { data: '${good}' } }`)
// big batch: 300 records x 60 events
const big = JSON.stringify({ Records: Array.from({ length: 300 }, (_, r) => ({ kinesis: { data: gz(env(Array.from({ length: 60 }, (_, i) => `2026-10-07T09:14:22.120Z\treq-${r}\tINFO\tline ${i} {"k":"v\\n"}\n`))) } })) })
const t = performance.now(); const bn = await run(big, NEW); console.log('\n### big batch draft', (performance.now() - t).toFixed(0), 'ms, lines', bn.out.split('\n').length, 'errors', JSON.stringify(bn.errors).slice(0, 200))
// payload with escaped slashes (PHP json_encode)
await cmp('escaped slashes', JSON.stringify({ awslogs: { data: gz(env(['x\n'])) } }).replace(/\//g, '\\/'))
