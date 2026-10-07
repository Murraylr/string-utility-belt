import { show, U, E } from './util'
const b64 = (o: unknown) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64')
const rec = (pk: string, seq: string, data: string, t: number) => ({ kinesis: { kinesisSchemaVersion: '1.0', partitionKey: pk, sequenceNumber: seq, data, approximateArrivalTimestamp: t }, eventSource: 'aws:kinesis', eventVersion: '1.0', eventID: `shardId-000000000000:${seq}`, eventName: 'aws:kinesis:record', invokeIdentityArn: 'arn:aws:iam::111122223333:role/orders-consumer', awsRegion: 'us-east-1', eventSourceARN: 'arn:aws:kinesis:us-east-1:111122223333:stream/orders' })
const ev = { Records: [
  rec('order-48213', '49656843311458374402123456789012345678901234567890123458', b64({ type: 'order.created', order_id: 48213, total: 4999, currency: 'usd' }), 1790848800.123),
  rec('order-48214', '49656843311458374402123456789012345678901234567890123459', b64({ type: 'order.paid', order_id: 48214, total: 1250, currency: 'usd' }), 1790848801.456),
] }
const steps = [
  U('x', 'regex_extract', { pattern: '(?<="data":\\s*")[A-Za-z0-9+/=]+', flags: 'g' }),
  E('e', { mode: 'lines' }, [U('b', 'base64_decode', {})]),
  U('j', 'jsonl_to_json', {}),
]
await show('kinesis pretty', JSON.stringify(ev, null, 2), steps)
await show('kinesis compact', JSON.stringify(ev), steps)
// pubsub push
await show('pubsub push', JSON.stringify({ message: { attributes: { source: 'billing' }, data: b64({ invoice: 'INV-2026-0042', status: 'paid' }), messageId: '13687025468392', publishTime: '2026-10-01T10:00:00.123Z' }, subscription: 'projects/example-project/subscriptions/billing-push' }, null, 2), steps)
// non-JSON payload (plain text record)
await show('plain text payload', JSON.stringify({ Records: [rec('k', '1', b64('heartbeat ok'), 1790848800)] }), steps)
// without each: base64_decode on the whole list
await show('no each', JSON.stringify(ev), [steps[0], U('b', 'base64_decode', {})])
