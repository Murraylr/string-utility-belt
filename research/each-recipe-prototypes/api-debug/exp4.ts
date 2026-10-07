import { show, U, E } from './util'
// @ts-ignore
import { A, B, C, NONE, ID, AT } from './gen-jwt.mjs'
const COND = { kind: 'regex', pattern: '^1[2-9]\\d{8}(?:\\d{3})?(?:\\.\\d+)?$', flags: '' }
const log = `2026-10-01T10:00:02Z INFO api req=7f3a2c GET /v1/orders 200 ip=203.0.113.24 auth="Bearer ${A}"
2026-10-01T10:05:00Z INFO api req=7f3a31 GET /v1/reports/daily 200 ip=198.51.100.7 auth="Bearer ${B}"
2026-10-01T10:05:12Z INFO api req=7f3a35 POST /v1/orders 201 ip=203.0.113.24 auth="Bearer ${A}"
2026-10-01T10:06:40Z WARN api req=7f3a3b GET /v1/orders/48214 401 ip=192.0.2.55 auth="Bearer ${C}" err="token expired"
`
console.log('log length', log.length)
const extract = U('x', 'extract_preset', { type: ['jwt'], unique: true })
await show('A payload only', log, [extract, E('e', { mode: 'lines' }, [U('d', 'jwt_decode', { part: 'payload' })]), U('j', 'jsonl_to_json', {})])
await show('B payload + nested ts', log, [extract, E('e', { mode: 'lines' }, [U('d', 'jwt_decode', { part: 'payload' }), E('t', { mode: 'json-values' }, [U('ts', 'timestamp_convert', { to: 'iso' }, { condition: COND })])]), U('j', 'jsonl_to_json', {})])
await show('C all, JSONL (no jsonl_to_json)', log, [extract, E('e', { mode: 'lines' }, [U('d', 'jwt_decode', { part: 'all' })])])
await show('none alg', `token=${NONE}`, [extract, E('e', { mode: 'lines' }, [U('d', 'jwt_decode', { part: 'payload' })]), U('j', 'jsonl_to_json', {})])
// truncated token (log line cut at 120 chars) and a JWE
const trunc = A.slice(0, 120)
const JWE = 'eyJhbGciOiJSU0EtT0FFUCIsImVuYyI6IkEyNTZHQ00ifQ.OKOawDo13gRp2ojaHV7LFpZcgV7T6DVZKTyKOMTYUmKoTCVJRgckCL9kiMT03JGeipsEdY3mx_etLbbWSrFr05kLzcSr4qKAq7YN7e9jwQRb23nfa6c9d-StnImGyFDbSv04uVuxIp5Zms1gNxKKK2Da14B8S4rzVRltdYwam_lDp5XnZAYpQdb76FdIKLaVmqgfwX7XWRxv2322i-vDxRfqNzo_tETKzpVLzfiwQyeyPGLBIO56YJ7eObdv0je81860ppamavo35UgoRdbYaBcoh9QcfylQr66oc6vFWXRcZ_ZT2LawVCWTIy3brGPi6UklfCpIMfIjf7iGdXKHzg.48V1_ALb6US04U3b.5eym8TW_c8SuK0ltJ3rpYIzOeDQz7TALvtu6UG9oMo4vpzs9tX_EFShS8iB7j6jiSdiwkIr3ajwQzaBtQD_A.XFBoMYUZodetZdvTiFvSkQ'
await show('truncated + JWE', `a ${trunc}\nb ${JWE}\nc ${B}`, [extract, E('e', { mode: 'lines' }, [U('d', 'jwt_decode', { part: 'payload' })]), U('j', 'jsonl_to_json', {})])
await show('CRLF log', log.replace(/\n/g, '\r\n'), [extract, E('e', { mode: 'lines' }, [U('d', 'jwt_decode', { part: 'payload' })]), U('j', 'jsonl_to_json', {})])
await show('no token at all', 'GET /health 200\n', [extract, E('e', { mode: 'lines' }, [U('d', 'jwt_decode', { part: 'payload' })]), U('j', 'jsonl_to_json', {})])
