import { createHmac, randomBytes } from 'node:crypto'
import { run } from '../../harness'
import recipe from '../jwt-recipe'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'

const b64u = (s: string | Buffer) => Buffer.from(s).toString('base64url')
const sign = (payload: object, header: object = { alg: 'HS256', typ: 'JWT' }) => {
  const h = b64u(JSON.stringify(header)); const p = b64u(JSON.stringify(payload))
  return `${h}.${p}.${createHmac('sha256', 'not-a-real-secret').update(`${h}.${p}`).digest('base64url')}`
}
const steps = toPipelineSteps(recipe.steps)
async function t(label: string, input: string) {
  const { out, errors } = await run(input, steps)
  console.log(`\n### ${label}${Object.keys(errors).length ? '  ERRORS ' + JSON.stringify(errors) : ''}`)
  console.log(out.length > 1200 ? out.slice(0, 1200) + '…' : out)
}
const A = sign({ sub: 'user_1', iat: 1790848800, exp: 1790852400 })
const MS = sign({ sub: 'user_ms', iat: 1790848800000, exp: 1790852400000 })
const NESTED = sign({ sub: 'u', iat: 1790848800, ext: { exp: 1790852400 }, 'https://example.com/claims': { tenant: 1500000001 }, amr: ['pwd', 'mfa'], aud: ['a', 'b'] })
const UNI = sign({ sub: 'u', name: 'Zoë Ångström 🚀', iat: 1790848800 })
const KID = sign({ sub: 'k8s', iat: 1790848800 }, { alg: 'RS256', kid: 'abc123' })
const JWE = `eyJhbGciOiJSU0EtT0FFUCIsImVuYyI6IkEyNTZHQ00ifQ.${b64u(randomBytes(64))}.${b64u(randomBytes(12))}.${b64u(randomBytes(40))}.${b64u(randomBytes(16))}`
const FLASK = `eyJ1c2VyX2lkIjo0Mn0.ZxY8Rg.${b64u(randomBytes(20))}`

await t('CRLF log with blank/comment lines', `# exported 2026-10-01\r\n\r\nGET /a auth="Bearer ${A}"\r\nGET /b auth="Bearer ${A}"\r\n`)
await t('URL-encoded Bearer%20 and %3D', `GET /cb?state=x&redirect=https%3A%2F%2Fapp.example.com%2F%23id_token%3D${A}\nAuthorization=Bearer%20${KID}`)
await t('ms timestamps and nested claims', `t1 ${MS}\nt2 ${NESTED}`)
await t('unicode claims', `x ${UNI}`)
await t('JWE + flask cookie + valid', `jwe=${JWE}\nsession=${FLASK}\nauth=${A}`)
await t('token at end of sentence', `The token was ${A}. Then it expired.`)
await t('token wrapped at 76 cols', `token: ${A.slice(0, 76)}\n${A.slice(76)}`)
await t('only garbage', 'nothing to see here\n')
await t('empty', '')
await t('html escaped json', `&quot;access_token&quot;:&quot;${A}&quot;`)
await t('preceded by underscore', `token_${A}`)
// lots of tokens
const many = Array.from({ length: 500 }, (_, i) => `req ${i} auth=${sign({ sub: 'user_' + i, iat: 1790848800 + i })}`).join('\n')
const t0 = Date.now(); const r = await run(many, steps); console.log('\n### 500 tokens', Date.now() - t0, 'ms', JSON.stringify(r.errors), r.out.length)
