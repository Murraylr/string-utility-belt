import { gzipSync } from 'node:zlib'
import { proto, run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/decode-cloudwatch-logs-data/recipe'
import DRAFT from './decode-cloudwatch-logs-data.recipe'

const problems = await proto(DRAFT)
const OLD = toPipelineSteps(ORIGINAL.steps), NEW = toPipelineSteps(DRAFT.steps)
for (const s of DRAFT.samples) {
  const shipped = ORIGINAL.samples.find(o => o.id === s.id)!
  console.log(`${s.id}: golden ${s.output === shipped.output ? 'UNCHANGED' : 'CHANGED'}; input ${s.input === shipped.input ? 'unchanged' : 'changed'}; main on this input ${(await run(s.input, OLD)).out === s.output ? 'matches' : 'DIFFERS: ' + JSON.stringify((await run(s.input, OLD)).out)}`)
}
// inputs with no gzip payload: an error must explain, not an empty output
const plainKinesis = JSON.stringify({ Records: [{ kinesis: { data: Buffer.from('{"orderId":"ord_1","status":"paid"}').toString('base64') } }] })
for (const [name, input] of [['Kinesis record, not gzipped', plainKinesis], ['a log line, no payload', '2026-10-07T09:14:22Z ERROR something failed']]) {
  const n = await run(input, NEW), o = await run(input, OLD)
  console.log(`\n${name}\n  draft out ${JSON.stringify(n.out.slice(0, 80))} errors ${JSON.stringify(n.errors).slice(0, 220)}\n  main  out ${JSON.stringify(o.out.slice(0, 80))} errors ${JSON.stringify(o.errors).slice(0, 220)}`)
}
// the literal-\n limit from the shipped guide
const lit = JSON.stringify({ awslogs: { data: gzipSync(Buffer.from(JSON.stringify({ messageType: 'DATA_MESSAGE', logEvents: [{ id: '1', timestamp: 1, message: 'Split records on \\n' }, { id: '2', timestamp: 2, message: 'done\n' }] }))).toString('base64') } })
console.log('\nliteral \\n at a message end: draft', JSON.stringify((await run(lit, NEW)).out), ' main', JSON.stringify((await run(lit, OLD)).errors))
console.log('problems:', problems)
