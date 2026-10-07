import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import ts from './ts-recipe'
import jwt from './jwt-recipe'
import logs from './logs-recipe'
import ua from './ua-recipe'
import kin from './kinesis-recipe'
const strip = (steps: any[], path: (s: any[]) => void) => { const c = JSON.parse(JSON.stringify(steps)); path(c); return c }
const errs = (r: any) => Object.keys(r.errors).length ? ' ERRORS ' + JSON.stringify(r.errors).slice(0, 300) : ''
async function cmp(label: string, recipe: any, mutate: (s: any[]) => void) {
  const steps = strip(toPipelineSteps(recipe.steps), mutate)
  for (const s of recipe.samples) {
    const r = await run(s.input, steps)
    console.log(`${label} / ${s.id}: ${r.out === s.output ? 'SAME' : 'DIFFERS'}${errs(r)}`)
  }
}
// nested conditions earn their place
await cmp('ts: no epoch condition', ts, s => { delete s[1].steps[0].condition })
await cmp('jwt: no NumericDate condition', jwt, s => { delete s[1].steps[1].steps[0].condition })
await cmp('jwt: no nested dates each', jwt, s => { s[1].steps.splice(1, 1) })
await cmp('jwt: unique off', jwt, s => { s[0].params.unique = false })
await cmp('logs: no JSON-line condition', logs, s => { delete s[0].steps[0].condition })
await cmp('logs: no epoch condition', logs, s => { delete s[0].steps[0].steps[0].condition })
await cmp('ua: no Mozilla condition', ua, s => { delete s[1].steps[0].condition })
await cmp('kin: flags g only (case-sensitive)', kin, s => { s[0].params.flags = 'g' })

// edge cases
const show = async (label: string, input: string, recipe: any) => { const r = await run(input, toPipelineSteps(recipe.steps)); console.log(`\n# ${label}${errs(r)}\n${r.out}`) }
const gz = (await import('node:zlib')).gzipSync(Buffer.from('{"logEvents":[]}')).toString('base64')
await show('kin: gzip (CloudWatch via Kinesis) record', JSON.stringify({ Records: [{ kinesis: { data: gz } }] }), kin)
await show('kin: aws kinesis get-records "Data"', JSON.stringify({ Records: [{ SequenceNumber: '1', Data: Buffer.from('{"a":1}').toString('base64'), PartitionKey: 'p' }] }), kin)
await show('kin: plain-text payload', JSON.stringify({ Records: [{ kinesis: { data: Buffer.from('heartbeat ok').toString('base64') } }, { kinesis: { data: Buffer.from('{"a":1}').toString('base64') } }] }), kin)
await show('ts: invalid JSON', '{"created_at": 1790848800,}', ts)
await show('ts: empty input', '', ts)
await show('jwt: empty / no tokens', 'GET /health 200\n', jwt)
await show('jwt: classic jwt.io token (sub 1234567890, iat 2018)', 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', jwt)
await show('logs: trailing spaces + tabs + nested time not converted', '  {"time":1790848800123,"ctx":{"started":1790848800}}\t\n', logs)
await show('ua: non-access-log line', 'some error line without quotes\n', ua)
