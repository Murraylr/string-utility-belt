import { gzipSync } from 'node:zlib'
import { run } from '../../harness'
import recipe from '../kinesis-recipe'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'

const steps = toPipelineSteps(recipe.steps)
async function t(label: string, input: string, s = steps) {
  const { out, errors } = await run(input, s)
  console.log(`\n### ${label}${Object.keys(errors).length ? '  ERRORS ' + JSON.stringify(errors) : ''}`)
  console.log(out.length > 900 ? out.slice(0, 900) + '…' : out)
}
const b64 = (o: unknown) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64')
const p1 = { type: 'order.created', order_id: 48213 }
const p2 = { type: 'order.paid', order_id: 48214, note: 'ok?>' }  // '>' and '?' push '/' and '+' into base64
console.log('b64 p2', b64(p2))
const ev = { Records: [{ kinesis: { partitionKey: 'a', data: b64(p1) } }, { kinesis: { partitionKey: 'b', data: b64(p2) } }] }

// Python Lambda print(event): dict repr with single quotes
const pyRepr = JSON.stringify(ev).replace(/"/g, "'").replace(/:/g, ': ').replace(/,/g, ', ')
await t('python print(event) repr', pyRepr)
// Node console.log(JSON.stringify(event)) in CloudWatch: line prefix
await t('cloudwatch line prefix', `2026-10-01T10:00:00.123Z\t5f1c2b0a-8d3e-4b7a-9c5d-2e4f6a8b0c1d\tINFO\t${JSON.stringify(ev)}`)
// "data" : with space before colon
await t('space before colon', JSON.stringify(ev, null, 2).replace(/"data":/g, '"data" :'))
// .NET System.Text.Json escapes + as + ; PHP escapes / as \/
await t('escaped + and /', JSON.stringify(ev).replace(/\+/g, '\\u002B').replace(/\//g, '\\/'))
// CSV payload in firehose
await t('csv payload', JSON.stringify({ records: [{ recordId: '1', data: b64('2026-10-01,GET,/v1/orders,200\n') }, { recordId: '2', data: b64(p1) }] }, null, 2))
// gzip payload
await t('gzip cloudwatch payload', JSON.stringify({ records: [{ recordId: '1', data: gzipSync(JSON.stringify({ messageType: 'DATA_MESSAGE' })).toString('base64') }] }))
// KPL aggregated record (magic bytes f3899ac2)
await t('KPL aggregated', JSON.stringify({ Records: [{ kinesis: { data: Buffer.concat([Buffer.from('f3899ac2', 'hex'), Buffer.from('0a01611a0808001a04746573740a', 'hex')]).toString('base64') } }] }))
// unrelated data field with plain string
await t('plain data field elsewhere', JSON.stringify({ Records: [{ kinesis: { data: b64(p1) } }], meta: { data: 'hello' } }))
// CRLF pretty JSON
await t('CRLF', JSON.stringify(ev, null, 2).replace(/\n/g, '\r\n'))
// aws kinesis get-records output
await t('get-records', JSON.stringify({ Records: [{ SequenceNumber: '1', ApproximateArrivalTimestamp: '2026-10-01T10:00:00.123000+00:00', Data: b64(p1), PartitionKey: 'a' }], NextShardIterator: 'AAAAAAAAAAH...', MillisBehindLatest: 0 }, null, 4))
// plain-text payload
await t('heartbeat text', JSON.stringify({ records: [{ data: b64('heartbeat ok') }] }))
