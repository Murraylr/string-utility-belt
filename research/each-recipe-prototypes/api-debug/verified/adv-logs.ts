import { run } from '../../harness'
import recipe from '../logs-recipe'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const steps = toPipelineSteps(recipe.steps)
async function t(label: string, input: string) {
  const { out, errors } = await run(input, steps)
  console.log(`\n### ${label}${Object.keys(errors).length ? '  ERRORS ' + JSON.stringify(errors).slice(0, 400) : ''}`)
  console.log(out.length > 900 ? out.slice(0, 900) + '…' : out)
}
const pino = (i: number) => `{"level":30,"time":${1790848800123 + i},"pid":4242,"hostname":"api","reqId":"req-${i}","msg":"incoming request","responseTime":${i % 50}}`
await t('kubectl logs --timestamps', `2026-10-01T10:00:00.123456789Z ${pino(1)}\n2026-10-01T10:00:00.223456789Z ${pino(2)}`)
await t('docker compose logs', `api-1  | ${pino(1)}\napi-1  | ${pino(2)}`)
await t('spaces, escapes, 1.0 and unicode in a line', `{ "level": "info", "ts": 1790935200.0412, "msg": "caf\\u00e9 \\/v1", "ratio": 1.0, "big": 12345678901234567890 }`)
await t('line without any epoch', `{ "level": "info",  "msg": "no time here" }`)
await t('truncated JSON line', `{"level":30,"time":1790848800123,"msg":"cut off by the log dri`)
await t('nested time only', `{"level":"info","ctx":{"started":1790848800},"msg":"x"}`)
await t('bunyan ISO time unchanged', `{"name":"api","hostname":"h","pid":1,"level":30,"msg":"hi","time":"2026-10-01T10:00:00.123Z","v":0}`)
// budget: lines + values share the 100 000 item budget
for (const n of [5000, 12000]) {
  const big = Array.from({ length: n }, (_, i) => pino(i)).join('\n')
  const t0 = Date.now(); const r = await run(big, steps)
  console.log(`\n### ${n} pino lines (7 values each)`, Date.now() - t0, 'ms', JSON.stringify(r.errors).slice(0, 300))
}
