import { gzipSync } from 'node:zlib'
import { proto, run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/decode-cloudwatch-logs-data/recipe'

/** A CloudWatch Logs subscription payload exactly as the service builds it: JSON envelope, gzip, Base64. */
function payload(logGroup: string, logStream: string, events: Array<[number, string]>): string {
  const envelope = {
    messageType: 'DATA_MESSAGE', owner: '123456789012', logGroup, logStream, subscriptionFilters: ['orders-to-kinesis'],
    logEvents: events.map(([ts, message], i) => ({ id: `3893001782345612345678901234567890123456789012345678${String(i).padStart(4, '0')}`, timestamp: ts, message })),
  }
  return gzipSync(Buffer.from(JSON.stringify(envelope))).toString('base64')
}

const REC1 = payload('/aws/lambda/orders-api', '2026/10/07/[$LATEST]0f1e2d3c4b5a69788796a5b4c3d2e1f0', [
  [1791364461120, 'START RequestId: 0b7d2c1e-4f3a-4e5b-9c8d-7a6b5c4d3e2f Version: $LATEST\n'],
  [1791364461188, '2026-10-07T09:14:21.188Z\t0b7d2c1e-4f3a-4e5b-9c8d-7a6b5c4d3e2f\tINFO\tCreated order ord_2Kp9QwE4\n'],
])
const REC2 = payload('/aws/lambda/orders-api', '2026/10/07/[$LATEST]0f1e2d3c4b5a69788796a5b4c3d2e1f0', [
  [1791364462301, '2026-10-07T09:14:22.301Z\t6e5d4c3b-2a19-4807-b6f5-e4d3c2b1a090\tERROR\tStock check failed: "SKU-1042" not found\n'],
  [1791364462315, 'END RequestId: 6e5d4c3b-2a19-4807-b6f5-e4d3c2b1a090\n'],
])
const kinesisRecord = (data: string, seq: string) => ({
  kinesis: { kinesisSchemaVersion: '1.0', partitionKey: 'b1e8a3f2c9d04e6f8a7b5c3d1e9f0a2b', sequenceNumber: seq, data, approximateArrivalTimestamp: 1791364463.112 },
  eventSource: 'aws:kinesis', eventVersion: '1.0', eventID: `shardId-000000000001:${seq}`, eventName: 'aws:kinesis:record',
  invokeIdentityArn: 'arn:aws:iam::123456789012:role/log-consumer', awsRegion: 'us-east-1',
  eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/app-logs',
})
export const BATCH_INPUT = JSON.stringify({ Records: [
  kinesisRecord(REC1, '49656730452213654784910876123508261927354016482103914501'),
  kinesisRecord(REC2, '49656730452213654784910876123508261927354016482103914502'),
] }, null, 2)

const B: Recipe = {
  ...ORIGINAL,
  updated: '2026-10-08',
  steps: [
    step('payloads', 'regex_extract', { pattern: '(?<![A-Za-z0-9+/])H4sI[A-Za-z0-9+/]+={0,2}', flags: 'g' },
      'Pulls out every gzip payload, one per line, whatever surrounds it: awslogs.data in a Lambda event, each record of a Kinesis or Firehose batch, or a bare value. Gzip data always starts with the bytes 1f 8b 08, which Base64 writes as H4sI.',
      { label: 'find every payload' }),
    each('records', { mode: 'lines' }, [
      laneStep('gunzip', 'gzip_decompress', { output: 'text' }),
      laneStep('messages', 'jsonpath', { path: '$.logEvents[*].message', mode: 'values', indent: 2 }, { label: 'keep each message' }),
      laneStep('lines', 'json_to_jsonl', {}),
    ],
    "Decodes each payload on its own: inflates the gzip and checks its CRC-32, keeps the message of every log event and drops the envelope, then writes each message as a JSON string on a line of its own, so a stack trace is still one line here.",
    { label: 'unpack each payload' }),
    each('decode', { mode: 'lines' }, [
      laneStep('unescape', 'code_string_unescape', { language: 'json' }),
      laneStep('final-newline', 'normalize_line_endings', { mode: 'lf', finalNewline: 'remove' }, { label: "drop the message's final line break" }),
    ],
    "Decodes every message on its own: strips its quotes and turns \\t, \\\" and \\n back into a tab, a quote and a real line break, so stack traces and logged JSON read as written. Then it drops the message's own final line break, which would otherwise leave a blank line after it.",
    { label: 'decode each message' }),
  ],
  samples: [...ORIGINAL.samples, { id: 'kinesis-batch', title: 'Kinesis batch, two records', input: BATCH_INPUT, output: '' }],
}

if (true) {
  const problems = await proto(B)
  for (const s of ORIGINAL.samples) {
    const r = await run(s.input, toPipelineSteps(B.steps))
    console.log(s.id, r.out === s.output ? 'SAME as main' : 'DIFFERENT')
  }
  const main = await run(BATCH_INPUT, toPipelineSteps(ORIGINAL.steps))
  console.log('\nmain on the 2-record batch:\n' + main.out)
  // other wrappers the guide says fail today
  const pyRepr = `{'awslogs': {'data': '${REC1}'}}`
  console.log('\nPython print(event) repr, main:', JSON.stringify((await run(pyRepr, toPipelineSteps(ORIGINAL.steps))).errors))
  console.log('Python print(event) repr, B   :', JSON.stringify((await run(pyRepr, toPipelineSteps(B.steps))).out))
  const wrapped = REC1.replace(/(.{76})/g, '$1\n')
  console.log('\nbare value wrapped at 76 cols, main:', JSON.stringify((await run(wrapped, toPipelineSteps(ORIGINAL.steps))).out).slice(0, 120))
  const bw = await run(wrapped, toPipelineSteps(B.steps))
  console.log('bare value wrapped at 76 cols, B   :', JSON.stringify(bw.out).slice(0, 120), JSON.stringify(bw.errors).slice(0, 200))
  console.log('problems:', problems)
}
