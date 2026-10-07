/**
 * Builds the draft recipe file for the decode-cloudwatch-logs-data refactor. The only new
 * data is the kinesis-event sample split into two records: its three VPC Flow Logs events
 * are decoded from the shipped payload, divided 2 + 1 between two envelopes and gzipped
 * again, so the golden output (the same three lines) does not change.
 */
import { gunzipSync, gzipSync } from 'node:zlib'
import { readFileSync, writeFileSync } from 'node:fs'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/decode-cloudwatch-logs-data/recipe'

const kinesis = JSON.parse(ORIGINAL.samples.find(s => s.id === 'kinesis-event')!.input)
const rec = kinesis.Records[0]
const envelope = JSON.parse(gunzipSync(Buffer.from(rec.kinesis.data, 'base64')).toString('utf8'))
console.log('shipped envelope keys:', Object.keys(envelope), 'events:', envelope.logEvents.length)

const first = { ...envelope, logEvents: envelope.logEvents.slice(0, 2) }
const second = { ...envelope, logEvents: envelope.logEvents.slice(2) }
const b64 = (o: unknown) => gzipSync(Buffer.from(JSON.stringify(o))).toString('base64')
const wrap = (s: string) => s.match(/.{1,100}/g)!.map(c => `'${c}'`).join(' +\n              ')

// keep the shipped record's fields; the second record gets the next sequence number and a later arrival time
const seq2 = (BigInt(rec.kinesis.sequenceNumber) + 1n).toString()
const sharedKinesis = (data: string, seq: string, at: number) => `{
          kinesis: {
            kinesisSchemaVersion: '1.0',
            partitionKey: '${rec.kinesis.partitionKey}',
            sequenceNumber: '${seq}',
            data:
              ${wrap(data)},
            approximateArrivalTimestamp: ${at},
          },
          eventSource: 'aws:kinesis',
          eventVersion: '1.0',
          eventID: 'shardId-000000000000:${seq}',
          eventName: 'aws:kinesis:record',
          invokeIdentityArn: 'arn:aws:iam::123456789012:role/flow-log-consumer',
          awsRegion: 'us-east-1',
          eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/flow-logs',
        }`
const kinesisInput = `JSON.stringify({
        Records: [${sharedKinesis(b64(first), rec.kinesis.sequenceNumber, rec.kinesis.approximateArrivalTimestamp)}, ${sharedKinesis(b64(second), seq2, Number((rec.kinesis.approximateArrivalTimestamp + 0.214).toFixed(3)))}],
      }, null, 2)`

// start from the shipped recipe.ts text and swap the steps, the JOIN script and the kinesis input
let src = readFileSync('/home/user/string-utility-belt/src/recipes/decode-cloudwatch-logs-data/recipe.ts', 'utf8')
src = src.replace(/import type \{ Recipe \} from '\.\.\/types'\nimport \{ step \} from '\.\.\/define'\n/,
  "import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'\nimport { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'\n")
src = src.replace(/\/\*\* Step 5[\s\S]*?\]\.join\('\\n'\)\n\n/, '')
src = src.replace(/'Paste a Lambda event with awslogs\.data, a Kinesis or Firehose record, or the bare Base64 value, and read the log events inside as plain lines/,
  "'Paste a Lambda event with awslogs.data, a Kinesis or Firehose batch, or the bare Base64 value, and read the log events of every record as plain lines")
src = src.replace(/  published: '2026-10-07',\n/, "  published: '2026-10-07',\n  updated: '2026-10-08',\n")
src = src.replace(/  steps: \[[\s\S]*?\n  \],\n  samples:/, `  steps: [
    step('payloads', 'regex_extract', { pattern: '(?<![A-Za-z0-9+/])H4sI[A-Za-z0-9+/]+={0,2}', flags: 'g' },
      'Pulls out every gzip payload, one per line: awslogs.data in a Lambda event, each record of a Kinesis or Firehose batch, or a bare value. Gzip data starts with the bytes 1f 8b 08, which Base64 writes as H4sI. Input without H4sI passes through, so the next step says what is wrong.',
      { label: 'find every payload', condition: { kind: 'regex', pattern: 'H4sI' } }),
    each('records', { mode: 'lines' }, [
      laneStep('gunzip', 'gzip_decompress', { output: 'text' }),
      laneStep('messages', 'jsonpath', { path: '$.logEvents[*].message', mode: 'values', indent: 2 }, { label: 'keep each message' }),
      laneStep('lines', 'json_to_jsonl', {}),
    ],
    'Unpacks each payload on its own: decodes the Base64, inflates the gzip and checks its CRC-32, keeps the message of every log event and drops the envelope, then writes each message as a JSON string on a line of its own, so a stack trace is still one line here.',
    { label: 'unpack each payload' }),
    each('decode', { mode: 'lines' }, [
      laneStep('unescape', 'code_string_unescape', { language: 'json' }),
      laneStep('final-newline', 'normalize_line_endings', { mode: 'lf', finalNewline: 'remove' }, { label: "drop the message's final line break" }),
    ],
    "Decodes every message on its own: strips its quotes and turns \\\\t, \\\\\\" and \\\\n back into a tab, a quote and a real line break, so stack traces and logged JSON read as written. Then it drops the message's own final line break, which would otherwise leave a blank line after it.",
    { label: 'decode each message' }),
  ],
  samples:`)
src = src.replace(/(id: 'kinesis-event',\n\s*title: )'Kinesis event \(VPC Flow Logs\)',\n\s*input: JSON\.stringify\(\{\n\s*Records: \[\{[\s\S]*?\}\],\n\s*\}, null, 2\),/,
  `$1'Kinesis batch, two records (VPC Flow Logs)',\n      input: ${kinesisInput},`)
writeFileSync('/tmp/claude-0/-home-user-string-utility-belt/985cf1f7-e22b-516f-8b3e-905ae6314e64/scratchpad/proto/refactors/decode-cloudwatch-logs-data.recipe.ts', src)
console.log('wrote draft,', src.length, 'chars')
