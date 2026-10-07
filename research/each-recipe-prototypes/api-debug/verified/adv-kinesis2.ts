import { run } from '../../harness'
import recipe from './kinesis-recipe'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
async function t(label: string, input: string) {
  const { out, errors } = await run(input, steps)
  console.log(`\n### ${label}${Object.keys(errors).length ? '  ERRORS ' + JSON.stringify(errors) : ''}`)
  console.log(out.length > 700 ? out.slice(0, 700) + '…' : out)
}
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64')
const p = { type: 'order.note', note: '?û€~' }
console.log('b64 with + and /:', b64(p))
const ev = { Records: [{ kinesis: { partitionKey: 'a', data: b64({ type: 'order.created', order_id: 48213 }) } }, { kinesis: { partitionKey: 'b', data: b64(p) } }] }
await t('JSON baseline', JSON.stringify(ev, null, 2))
await t('python repr (synthetic)', JSON.stringify(ev).replace(/"/g, "'").replace(/:/g, ': ').replace(/,/g, ', '))
await t('space before colon', JSON.stringify(ev, null, 2).replace(/"data":/g, '"data" :'))
await t('.NET \\u002B escaping', JSON.stringify(ev).replace(/\+/g, '\\u002B'))
await t('PHP \\/ escaping', JSON.stringify(ev).replace(/\//g, '\\/'))
await t('node util.inspect (single quotes, unquoted keys)', `{ Records: [ { kinesis: { partitionKey: 'a', data: '${b64({ a: 1 })}' } } ] }`)
