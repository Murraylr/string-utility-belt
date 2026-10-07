import { run } from '../../harness'
import recipe from '../ts-recipe'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'

const steps = toPipelineSteps(recipe.steps)
async function t(label: string, input: string) {
  const { out, errors } = await run(input, steps)
  console.log(`\n### ${label}${Object.keys(errors).length ? '  ERRORS ' + JSON.stringify(errors) : ''}`)
  console.log(out.length > 1500 ? out.slice(0, 1500) + '…' : out)
}

// Stripe-style invoice (epoch seconds, cents, metadata {}, nested lists)
await t('stripe invoice', JSON.stringify({
  id: 'in_1Q2w3E4r5T6y7U8i', object: 'invoice', amount_due: 2000, created: 1790848800,
  period_start: 1788256800, period_end: 1790848800, due_date: null, metadata: {},
  lines: { object: 'list', data: [{ id: 'il_1', amount: 2000, period: { start: 1788256800, end: 1790848800 } }], has_more: false },
  status_transitions: { finalized_at: 1790852400, paid_at: null },
}, null, 2))

// Google Ads style micros as strings, byte size, 13-digit id, Shopify-ish id
await t('false positives', JSON.stringify({
  costMicros: '1500000000', bytes: 1610612736, order_id: 1450789469123, variant_id: 7234567890123,
  zip: '12345', isbn: 9781234567897, tenant: 1500000001, duration_ms: 1500000,
}, null, 2))

// Mongo extended JSON and DynamoDB JSON
await t('mongo extended json', '{"_id":{"$oid":"65f1c2a9e4b0a1b2c3d4e5f6"},"createdAt":{"$date":{"$numberLong":"1790848800000"}},"n":{"$numberInt":"5"}}')
await t('dynamodb json', '{"Item":{"pk":{"S":"ORDER#48213"},"createdAt":{"N":"1790848800"},"ttl":{"N":"1793440800"},"qty":{"N":"3"}}}')

// 64-bit ids (Twitter v1 / snowflakes) as numbers
await t('int64', '{"id":1712345678901234567,"id_str":"1712345678901234567","created_at":1790848800}')

// NDJSON pasted by mistake
await t('ndjson', '{"ts":1790848800,"msg":"a"}\n{"ts":1790848801,"msg":"b"}\n')

// curl -i output with headers
await t('curl -i', 'HTTP/2 200\r\ncontent-type: application/json\r\n\r\n{"created":1790848800}')

// JSON with a comment / trailing comma
await t('jsonc', '{\n  // created\n  "created": 1790848800,\n}')

// Python repr
await t('python repr', "{'created': 1790848800, 'ok': True}")

// HTML-escaped JSON (copied from a page source)
await t('html escaped', '{&quot;created&quot;:1790848800}')

// stringified JSON inside a field (common: body as string)
await t('nested stringified', JSON.stringify({ body: JSON.stringify({ created: 1790848800 }), ts: 1790848800 }, null, 2))

// unicode and very long string
await t('unicode + long', JSON.stringify({ name: 'Zoë 🚀', note: 'x'.repeat(5000), ts: 1790848800 }))

// primitives top-level
await t('bare number', '1790848800')
await t('empty object', '{}')
await t('array of numbers', '[1790848800, 1790848801000, 42]')

// big list: 3000 records
const big = JSON.stringify({ data: Array.from({ length: 3000 }, (_, i) => ({ id: i + 1, created: 1790848800 + i })) })
const t0 = Date.now(); const r = await run(big, steps); console.log('\n### 3000 records', Date.now() - t0, 'ms', Object.keys(r.errors).length ? r.errors : 'ok', r.out.length)
// 40000 records -> 80000 values
const big2 = JSON.stringify({ data: Array.from({ length: 60000 }, (_, i) => ({ id: i + 1, created: 1790848800 + i })) })
const t1 = Date.now(); const r2 = await run(big2, steps); console.log('### 60000 records (120k values)', Date.now() - t1, 'ms', JSON.stringify(r2.errors).slice(0, 300))
