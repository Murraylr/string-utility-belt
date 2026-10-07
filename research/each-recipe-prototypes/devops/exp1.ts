import { run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'

const steps = toPipelineSteps([
  step('parse', 'env_to_json', { typed: false, expand: false, indent: 2 }, 'x'),
  each('enc', { mode: 'json-values' }, [laneStep('b64', 'base64_encode')], 'x'),
  step('wrap', 'replace', { pattern: '^([\\s\\S]*)$', replacement: '{"apiVersion":"v1","kind":"Secret","metadata":{"name":"app-env"},"type":"Opaque","data":$1}', regex: true, flags: '' }, 'x'),
  step('yaml', 'json_to_yaml', { indent: 2, lineWidth: 0, sortKeys: false }, 'x'),
])
const env = `# app settings
export DATABASE_URL="postgres://app:s3cret@db.example.com:5432/app"
REDIS_HOST=cache.example.com # inline comment
FEATURE_FLAG=on
DEBUG=yes
EMPTY=
QUOTED='single $NOT_EXPANDED'
MULTI="line one
line two"
UNICODE=café ☕
`
const r = await run(env, steps)
console.log(r.out, r.errors)
const r2 = await run(env.replace(/\n/g, '\r\n'), steps)
console.log(r2.out === r.out, r2.errors)
