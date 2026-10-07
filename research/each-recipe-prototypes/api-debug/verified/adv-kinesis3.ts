import { run } from '../../harness'
import recipe from './kinesis-recipe'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64')
for (const [label, input] of [
  ['get-records', JSON.stringify({ Records: [{ SequenceNumber: '1', Data: b64({ a: 1 }), PartitionKey: 'a' }], NextShardIterator: 'AAAA', MillisBehindLatest: 0 }, null, 4)],
  ['metadata / data_key not grabbed', JSON.stringify({ records: [{ data: b64({ a: 2 }), metadata: 'aGVsbG8=', data_key: 'aGVsbG8=' }] })],
] as const) {
  const { out, errors } = await run(input, steps)
  console.log(`### ${label}`, JSON.stringify(errors), '\n' + out)
}
