import { show, U, E } from './util'
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64')
const ev = { Records: [
  { kinesis: { kinesisSchemaVersion: '1.0', partitionKey: 'order-48213', sequenceNumber: '49590338271490256608559692538361571095921575989136588898', data: b64({ type: 'order.created', order_id: 48213, total: 4999 }), approximateArrivalTimestamp: 1790848800.123 }, eventSource: 'aws:kinesis', eventID: 'shardId-000000000000:49590338271490256608559692538361571095921575989136588898', awsRegion: 'us-east-1' },
  { kinesis: { kinesisSchemaVersion: '1.0', partitionKey: 'order-48214', sequenceNumber: '49590338271490256608559692540925702759324208523137515618', data: b64({ type: 'order.paid', order_id: 48214, total: 1250 }), approximateArrivalTimestamp: 1790848801.456 }, eventSource: 'aws:kinesis', eventID: 'shardId-000000000000:49590338271490256608559692540925702759324208523137515618', awsRegion: 'us-east-1' },
] }
const input = JSON.stringify(ev, null, 2)
await show('kinesis: jsonpath + each json-array base64', input, [U('p', 'jsonpath', { path: '$.Records[*].kinesis.data' }), E('e', { mode: 'json-array' }, [U('b', 'base64_decode', {})])])
// in place: Records -> each element ... nested: each json-values on top? Records is nested under key; use json_flatten route with condition on the data path? (value-only, cannot see key)
await show('json_validate output', '{"a":1}', [U('v', 'json_validate', {})])
