import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'

const recipe: Recipe = {
  slug: 'decode-cloudwatch-logs-data',
  name: 'Decode CloudWatch Logs subscription data',
  summary:
    'Paste a Lambda event with awslogs.data, a Kinesis or Firehose batch, or the bare Base64 value, and read the log events of every record as plain lines, with the gzip, the JSON envelope and the escapes undone.',
  category: 'Web & APIs',
  primaryQuery: 'decode cloudwatch logs subscription data',
  published: '2026-10-07',
  updated: '2026-10-08',
  related: ['decode-helm-release-secret', 'unescape-stringified-json'],
  steps: [
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
    "Decodes every message on its own: strips its quotes and turns \\t, \\\" and \\n back into a tab, a quote and a real line break, so stack traces and logged JSON read as written. Then it drops the message's own final line break, which would otherwise leave a blank line after it.",
    { label: 'decode each message' }),
  ],
  samples: [
    {
      id: 'lambda-event',
      title: 'Lambda subscription event',
      input: JSON.stringify({
        awslogs: {
          data:
            'H4sIAAAAAAAAAI2Sb0/bMBDGv0oU7WVDfGfHf/KuiI4hwUBpp00jCDmJW6I1SUncdR3iu+9SQELa0HhnPc/Zd7/n/BA2bhjs' +
            'yi32Gxem4cl0Mb29mM3n09NZOAm7Xet6kgG5SKTShgGSvO5Wp3233ZAT290Qr21TVDYu71z5o9v6yG7qp6q5751tqAwZyhhY' +
            'zFR8/eF8upjNFzemAMdKuRQWK+FUoUu+TCxU6EQhS23piWFbDGVfb3zdtR/rtXf9EKbX48vRsut3tq9ovJtDq9lP1/rRfQjr' +
            'ijpyg4zT1AaBgeQcuJaoIZFGSJVooXjCQKFGoRKUyACYUUxr6uprCsXbhvhAGeBSCImAbPIS1jNQBCxiasFMCiJFPKKS77lP' +
            'lqw0VrsICqwiUXIXGWKMZKFKXRnHlmBzP8uyyyz3V3bf0NxB5cp13boqeMjDbqQ6q/IwPZxv1ad7PG++mTyc5GHZVe7glAR/' +
            '+3LtYNmm27aeTGGMeczb8HHydxZgnsiJinZqjAakpXKNTKOBhBsJgjQJWiX87Sz0/7PQ787i6zT7nPvM+X5ft6ugvLP9yk0C' +
            '671rNj7AmP8bRrHEKKGTcXskaK6EkSgYJuN/BcMSoYBwGZ0kvgXDDbyGyWZXl9kiyNz9lmrPqjR4H8TJtrfjN00DVHAkkqAZ' +
            'cn9cr9e01NceHowL13T9PpjXvx01AAwujkm0v4Jn48vgqDOAPhgj/s3jHxc2ypqsAwAA',
        },
      }, null, 2),
      output: '2026-10-07T09:14:22.120Z\t5f0c9a8e-1b2d-4c3e-9f4a-6b7c8d9e0f1a\tERROR\tPayment declined {"orderId":"ord_7Hq2LmX9","code":"card_declined","amount":4999}\n2026-10-07T09:14:22.128Z\t5f0c9a8e-1b2d-4c3e-9f4a-6b7c8d9e0f1a\tWARN\tRetrying charge, attempt 2/3\nREPORT RequestId: 5f0c9a8e-1b2d-4c3e-9f4a-6b7c8d9e0f1a\tDuration: 271.45 ms\tBilled Duration: 272 ms\tMemory Size: 512 MB\tMax Memory Used: 118 MB\t',
    },
    {
      id: 'kinesis-event',
      title: 'Kinesis batch, two records (VPC Flow Logs)',
      input: JSON.stringify({
        Records: [{
          kinesis: {
            kinesisSchemaVersion: '1.0',
            partitionKey: '4f7d0a39c2be41e6a8c5d03b9e1f2a74',
            sequenceNumber: '49656730452213654784910876123508261927354016482103914498',
            data:
              'H4sIAAAAAAAAA63QTWvCQBAG4L+yzDkJMzu7m2xuwaYeSmlBb0VK1FWW5otsVIr434tKv6CHQnsbeOF9eeYIjQuh2rr5a+8gh5ti' +
              'Xjzfl7NZMS0hgu7QugFyIMlKmzSzSBIiqLvtdOh2PeSw71fxpu4Ocd1twzWajYOrGsjBtT7GipZyxWvl9MZgSllc1TVEEHbLsBp8' +
              'P/quvfX16IYA+ROMXfziWxd8gMWlrNy7djxHR/BryIGtRGalUbK2mZGK+NxqGUml2hChVYZRassZSc2UkVKICBGMvnFhrJoeckot' +
              'sbkEiNH7DyAHKb5SxY8CQTZLNCWEmEglJHKCCREnhEJZ0lIoxcIIkoIyheJz7OPUVhSTSfk4Fw93cIr+ZqP/tH3TfIeeVVefEYRC' +
              's/yFbXF6Aw99yYtjAgAA',
            approximateArrivalTimestamp: 1791364462.731,
          },
          eventSource: 'aws:kinesis',
          eventVersion: '1.0',
          eventID: 'shardId-000000000000:49656730452213654784910876123508261927354016482103914498',
          eventName: 'aws:kinesis:record',
          invokeIdentityArn: 'arn:aws:iam::123456789012:role/flow-log-consumer',
          awsRegion: 'us-east-1',
          eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/flow-logs',
        }, {
          kinesis: {
            kinesisSchemaVersion: '1.0',
            partitionKey: '4f7d0a39c2be41e6a8c5d03b9e1f2a74',
            sequenceNumber: '49656730452213654784910876123508261927354016482103914499',
            data:
              'H4sIAAAAAAAAA22Qy0rDQBSGX2U46yScM7dkZhc0FhQRbHdSJG2nZTDJhMy0RUrfXaJ4Wbj74YP/doHexdge3Op9dGDhtl7Vr4/N' +
              'clkvGsggnAc3gQXiQipdVgaJQwZdOCymcBzBwmnc5vsunPMuHOIXWqbJtT1YcIPPsaUN34qddGqvsaQqb7sOMojHTdxOfkw+DHe+' +
              'S26KYF8ghfzNDy76COtPs+bkhjSjC/gdWBCGoxBSIRfKVJpLErOrEUiyVJoIjdQCuTKiIq4EVSQl4tw6+d7F1PYjWCoNCT0DRMy+' +
              'PwALnP2dyv5dwMjwAgtelCXjKAosiERByBQpUoxzphkxjew35Ucqw56b++ZmxZ4e4Lq+fgAhm4v1gAEAAA==',
            approximateArrivalTimestamp: 1791364462.945,
          },
          eventSource: 'aws:kinesis',
          eventVersion: '1.0',
          eventID: 'shardId-000000000000:49656730452213654784910876123508261927354016482103914499',
          eventName: 'aws:kinesis:record',
          invokeIdentityArn: 'arn:aws:iam::123456789012:role/flow-log-consumer',
          awsRegion: 'us-east-1',
          eventSourceARN: 'arn:aws:kinesis:us-east-1:123456789012:stream/flow-logs',
        }],
      }, null, 2),
      output: '2 123456789012 eni-0a1b2c3d4e5f60718 198.51.100.24 203.0.113.10 49152 443 6 12 1840 1791364400 1791364459 ACCEPT OK\n2 123456789012 eni-0a1b2c3d4e5f60718 203.0.113.10 198.51.100.24 443 49152 6 10 5320 1791364400 1791364459 ACCEPT OK\n2 123456789012 eni-0a1b2c3d4e5f60718 192.0.2.77 203.0.113.10 51515 22 6 1 60 1791364400 1791364459 REJECT OK',
    },
    {
      id: 'cli-get-records',
      title: 'aws kinesis get-records output',
      input: JSON.stringify({
        Records: [{
          SequenceNumber: '49656730452213654784910876123508261927354016482103914498',
          ApproximateArrivalTimestamp: '2026-10-07T09:14:23.415000+00:00',
          Data:
            'H4sIAAAAAAAAAKWS3Y7TMBCFXwX5lqbx+C927ypRKiRWu1J7R1bIsSdtxLYJictqVfXdmc12BQJagcjVZM7xGfuzj2yHw+A3' +
            'uH7qkM3Yu/l6/vlmsVrNlws2Ye3jHntqg5BKm8I6DoLaD+1m2beHjpTcPw6575qNT/jon/K2j9gPGXVyHwJlv9hXqUe/I7+t' +
            'QaHSdUD0YAqvvTQRY1QVeqGVJPtwqIbQN11q2v375iFRHpt9YqnNvjR7HJqB3Y+Zi2+4T8/SkTWRoqUTXNI+HYBwUAgLykmr' +
            'CuBCG2nBiUIZri2JXFKp7fMKo2hkaghD8js6ERQOpFHKgC3U5BUPxR9L1uPXA/k+xJLNShZMDSi8ymwlY6ZqjZnzRchEhIqj' +
            'rJXXVckmJWu60U+7m/IpgJwKNfbPcWsaPhp4kd+GlAsuzIy7GaiZgDdvOX2jfZtSd4Np276Mv7tdrc8xQ3voA975tB2V8yWM' +
            'Ip0qHYbzfHj1d+1+wI+435xXaFuyEztNfiUpgAOBol+wIzJOFC9XF0gKCfwqSR5dVXiJmQ5QZ4qgElMTM1dzhCC8rFT8mSQ4' +
            'O9UwBc6n7m9Jisskl4vrIPNjE0+/0+SXaCoQf8YptVJSX0X4ozLmEk6ni6s4CxRBVeAzFyXh9Aazigeb6RqiQOlVZcL/Pswr' +
            'OP/5YWouLqGUZiR5f/oO0evHDakEAAA=',
          PartitionKey: 'a3c9e1f05b7d4826b1e0c4d7f9a2e6b3',
        }],
        NextShardIterator: 'AAAAAAAAAAFz8r2kQ7mXv0bN1cT4hJ6pW9yLqE3sD5gU8aRoK2iV7nC1xZ4tB6mF0wH3jG9eS',
        MillisBehindLatest: 0,
      }, null, 4),
      output: '{"requestId":"c6f1e2a4-8b3d-4f5e-9a7c-2d1b0e3f4a5b","ip":"203.0.113.24","requestTime":"07/Oct/2026:09:14:21 +0000","httpMethod":"POST","resourcePath":"/orders","status":"201","responseLength":"58"}\n{"requestId":"0d9b7a3e-5c1f-4e2a-8b6d-9f0e1c2a3b4d","ip":"198.51.100.9","requestTime":"07/Oct/2026:09:14:22 +0000","httpMethod":"GET","resourcePath":"/orders/{id}","status":"200","responseLength":"412"}\n{"requestId":"7e2c4b1a-9d3f-4a6e-b0c8-5f1d2e3a4b6c","ip":"203.0.113.24","requestTime":"07/Oct/2026:09:14:22 +0000","httpMethod":"POST","resourcePath":"/orders","status":"502","responseLength":"36"}',
    },
    {
      id: 'bare-data-traceback',
      title: 'Bare data value, Python traceback',
      input:
        'H4sIAAAAAAAAAJVSXWvbMBT9K8LsIYW4lmR92W8ZzUqhWyExe1gchmzLnYljZ5KSEEr/e6+7ZG23FLa3i+6959yjcx6CtXFO' +
        '35vssDFBGlxNssn3z9P5fHI9DcZBv++MhWdCY8aFVAkmFJ7b/v7a9tsNdCK9d1Gr10Wlo6bbmc739hC6Q1f+mpt7a/QaBimm' +
        'IiI4wjJafLidZNN5tsQlM0rTQlSkZjoxqohLWfGaGqJFkWCAcNvClbbZ+KbvPjWtN9YF6WJADuve7rWt4MDlM9V0YB+6D0FT' +
        'AWOcUByzhMhYUBJjyRKuoBCMEww9xSQXBNMkflsNrL6Bb/F6DQqJTEgscSIkU2p8+i6An2eTWYZm5ucWRm+qFKkqLhkpZCio' +
        'SUJWYx0WvFIhKaVJNK1ZITD6CgJASoqOf5B3weP474OBjCo+MLMEcyqIGiqOiaB/VoK8dzAn9PXBi+lsdjdb5n6wIiQ4xDIj' +
        'JMU0ZfISZr/l/l8k5P7m5DMafEa1blpTIbADudUW5UH28TbEmNE8yLvM6tIUulyh0bp3HllTwi4qdduiVjt/keYdQuCsgcVo' +
        'p23ktVtFerO53BzyYIzapjOIqzFqOvRDd1Vr7LCBAMkZuzOjxpv1xVmQ33l8DUXJM9Rx+wilG2fQ3dbf1XPfl6sR6ADIl/2X' +
        'VopO6s75JjknEKSYSQq2gT/gEmSNKX6mou/6xt4Ebfrl6n9jNqRq+fgEkzQDn90DAAA=',
      output: 'START RequestId: 8d3c41b7-62e9-4f0a-b5d8-1c7e9a2f4b60 Version: $LATEST\n[ERROR]\t2026-10-07T11:02:47.512Z\t8d3c41b7-62e9-4f0a-b5d8-1c7e9a2f4b60\tInventory sync failed for sku "TBL-0042"\nTraceback (most recent call last):\n  File "/var/task/app.py", line 58, in handler\n    reserve(item)\n  File "/var/task/inventory.py", line 21, in reserve\n    raise OutOfStock(sku)\ninventory.OutOfStock: TBL-0042\nEND RequestId: 8d3c41b7-62e9-4f0a-b5d8-1c7e9a2f4b60',
    },
  ],
}
export default recipe
