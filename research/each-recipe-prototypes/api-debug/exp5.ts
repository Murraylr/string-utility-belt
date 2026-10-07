import { show, U, E } from './util'
// @ts-ignore
import { A, B } from './gen-jwt.mjs'
const COND = { kind: 'regex', pattern: '^1[2-9]\\d{8}(?:\\d{3})?(?:\\.\\d+)?$', flags: '' }
const JWE = 'eyJhbGciOiJSU0EtT0FFUCIsImVuYyI6IkEyNTZHQ00ifQ.OKOawDo13gRp2ojaHV7LFpZcgV7T6DVZKTyKOMTYUmKoTCVJRgckCL9kiMT03JGeipsEdY3mx_etLbbWSrFr05kLzcSr4qKAq7YN7e9jwQRb23nfa6c9d.48V1_ALb6US04U3b.5eym8TW_c8SuK0ltJ3rpYIzOeDQz7TALvtu6UG9oMo4vpzs9tX_EFShS8iB7j6jiSdiwkIr3ajwQzaBtQD_A.XFBoMYUZodetZdvTiFvSkQ'
const steps = [
  U('x', 'extract_preset', { type: ['jwt'], unique: true }),
  E('e', { mode: 'lines' }, [U('d', 'jwt_decode', { part: 'payload' }), E('t', { mode: 'json-values' }, [U('ts', 'timestamp_convert', { to: 'iso' }, { condition: COND })])], { onError: 'empty' }),
  U('j', 'jsonl_to_json', {}),
]
await show('truncated + JWE + good, onError empty', `a ${A.slice(0, 120)}\nb ${JWE}\nc ${B}`, steps)
// token whose payload has a non-epoch numeric claim and a string exp
const { sign } = await import('./gen-jwt.mjs')
await show('odd claims', sign({ alg: 'HS256' }, { sub: '1234567890', tenant_id: 1500000001, exp: '1790852400', nbf: 1790848800.5, amr: ['pwd', 'mfa'], ver: 2 }), steps)
