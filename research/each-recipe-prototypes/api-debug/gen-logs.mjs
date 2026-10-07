const j = (o) => JSON.stringify(o)
const pino = [
  '',
  '> orders-api@2.4.1 start',
  '> node server.js',
  '',
  j({ level: 30, time: 1790848800123, pid: 4242, hostname: 'orders-api-7d9f8', reqId: 'req-1', req: { method: 'GET', url: '/v1/orders?status=open', remoteAddress: '203.0.113.24' }, msg: 'incoming request' }),
  j({ level: 30, time: 1790848800141, pid: 4242, hostname: 'orders-api-7d9f8', reqId: 'req-1', res: { statusCode: 200 }, responseTime: 18, msg: 'request completed' }),
  j({ level: 50, time: 1790848802907, pid: 4242, hostname: 'orders-api-7d9f8', reqId: 'req-2', err: { type: 'TimeoutError', message: 'upstream timed out after 2500ms' }, msg: 'request errored' }),
].join('\n') + '\n'
const zap = [
  '{"level":"info","ts":1790935200.0412,"caller":"server/main.go:57","msg":"listening","addr":":8080"}',
  '{"level":"warn","ts":1790935261.8873,"caller":"payments/client.go:142","msg":"retrying charge","order_id":48214,"attempt":2,"backoff":0.25}',
  'panic: runtime error: invalid memory address or nil pointer dereference',
  '[signal SIGSEGV: segmentation violation code=0x1 addr=0x18 pc=0x6b2f1c]',
  '',
  'goroutine 87 [running]:',
  'example.com/orders/payments.(*Client).Charge(0x0, {0x8c1f40, 0xc0001a2000}, 0xbc52)',
  '\t/src/payments/client.go:151 +0x3c',
].join('\n') + '\n'
const py = [
  j({ created: 1791021600.512345, levelname: 'INFO', name: 'worker.export', lineno: 88, process: 3117, message: 'export started', job_id: 'exp_20261003_01', rows: 120000 }),
  j({ created: 1791021725.007912, levelname: 'ERROR', name: 'worker.export', lineno: 131, process: 3117, message: 'export failed', job_id: 'exp_20261003_01', duration_ms: 124496, retry_at: 1791022025 }),
].join('\r\n') + '\r\n'
for (const s of [pino, zap, py]) console.log(JSON.stringify(s))
