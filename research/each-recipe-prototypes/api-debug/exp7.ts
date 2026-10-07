import { show, U, E } from './util'
const COND = { kind: 'regex', pattern: '^1[2-9]\\d{8}(?:\\d{3})?(?:\\.\\d+)?$', flags: '' }
const steps = [E('lines', { mode: 'lines' }, [E('vals', { mode: 'json-values' }, [U('ts', 'timestamp_convert', { to: 'iso' }, { condition: COND })], { condition: { kind: 'regex', pattern: '^\\s*\\{' } })])]
const pino = [
  { level: 30, time: 1790848800123, pid: 4242, hostname: 'api-7d9f8', reqId: 'req-1', req: { method: 'GET', url: '/v1/orders', remoteAddress: '203.0.113.24' }, msg: 'incoming request' },
  { level: 30, time: 1790848800141, pid: 4242, hostname: 'api-7d9f8', reqId: 'req-1', res: { statusCode: 200 }, responseTime: 18, msg: 'request completed' },
  { level: 50, time: 1790848802907, pid: 4242, hostname: 'api-7d9f8', reqId: 'req-2', err: { type: 'TimeoutError', message: 'upstream timed out after 2500ms' }, msg: 'request errored' },
].map(o => JSON.stringify(o)).join('\n') + '\n'
await show('pino', pino, steps)
const zap = `{"level":"info","ts":1790848800.1234567,"caller":"server/handler.go:88","msg":"request served","method":"GET","path":"/v1/orders","status":200,"latency":0.012345}
panic: runtime error: invalid memory address or nil pointer dereference
{"level":"error","ts":1790848803.5,"caller":"server/handler.go:121","msg":"upstream failed","user_id":1042,"phone":"4155550123"}
`
await show('zap + non-json line', zap, steps)
await show('CRLF + blank line', pino.replace(/\n/g, '\r\n').replace('\r\n', '\r\n\r\n'), steps)
await show('malformed JSON line', '{"time":1790848800123,"msg":"cut off', steps)
