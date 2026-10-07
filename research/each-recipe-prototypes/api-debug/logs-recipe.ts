import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'

/** 10-digit epoch seconds or 13-digit epoch milliseconds from 2008-01-10 to 2033-05-18, optional fraction. */
const EPOCH = '^1[2-9]\\d{8}(?:\\d{3})?(?:\\.\\d+)?$'

const recipe: Recipe = {
  slug: 'json-log-timestamps-to-dates',
  name: 'Make epoch timestamps in JSON logs readable',
  summary:
    'Paste JSON log lines from pino, zap or python-json-logger and get the same lines back with epoch time fields shown as ISO 8601 dates, while banners and stack traces stay as they were.',
  category: 'DevOps & Config',
  primaryQuery: 'convert epoch timestamps in json logs',
  published: '2026-10-08',
  related: ['decode-cloudwatch-logs-data', 'unescape-stringified-json'],
  steps: [
    each('per-line', { mode: 'lines' }, [
      { id: 'per-field', type: 'each', enabled: true, split: { mode: 'json-values' }, skipEmpty: true,
        condition: { kind: 'regex', pattern: '^\\s*\\{', flags: '' },
        steps: [laneStep('to-iso', 'timestamp_convert', { to: 'iso', timezone: 'UTC' }, { condition: { kind: 'regex', pattern: EPOCH } })] },
    ],
      'Takes the log one line at a time. On lines that start with an opening brace, each top-level value is checked on its own, and a 10-digit seconds or 13-digit milliseconds number from 2008 to 2033 becomes an ISO date. Other lines, keys and values are left exactly as they were.',
      { label: 'convert time fields on each line' }),
  ],
  samples: [
    { id: 'pino', title: 'Node.js pino (milliseconds)', input: "\n> orders-api@2.4.1 start\n> node server.js\n\n{\"level\":30,\"time\":1790848800123,\"pid\":4242,\"hostname\":\"orders-api-7d9f8\",\"reqId\":\"req-1\",\"req\":{\"method\":\"GET\",\"url\":\"/v1/orders?status=open\",\"remoteAddress\":\"203.0.113.24\"},\"msg\":\"incoming request\"}\n{\"level\":30,\"time\":1790848800141,\"pid\":4242,\"hostname\":\"orders-api-7d9f8\",\"reqId\":\"req-1\",\"res\":{\"statusCode\":200},\"responseTime\":18,\"msg\":\"request completed\"}\n{\"level\":50,\"time\":1790848802907,\"pid\":4242,\"hostname\":\"orders-api-7d9f8\",\"reqId\":\"req-2\",\"err\":{\"type\":\"TimeoutError\",\"message\":\"upstream timed out after 2500ms\"},\"msg\":\"request errored\"}\n", output: "\n> orders-api@2.4.1 start\n> node server.js\n\n{\"level\":30,\"time\":\"2026-10-01T10:00:00.123Z\",\"pid\":4242,\"hostname\":\"orders-api-7d9f8\",\"reqId\":\"req-1\",\"req\":{\"method\":\"GET\",\"url\":\"/v1/orders?status=open\",\"remoteAddress\":\"203.0.113.24\"},\"msg\":\"incoming request\"}\n{\"level\":30,\"time\":\"2026-10-01T10:00:00.141Z\",\"pid\":4242,\"hostname\":\"orders-api-7d9f8\",\"reqId\":\"req-1\",\"res\":{\"statusCode\":200},\"responseTime\":18,\"msg\":\"request completed\"}\n{\"level\":50,\"time\":\"2026-10-01T10:00:02.907Z\",\"pid\":4242,\"hostname\":\"orders-api-7d9f8\",\"reqId\":\"req-2\",\"err\":{\"type\":\"TimeoutError\",\"message\":\"upstream timed out after 2500ms\"},\"msg\":\"request errored\"}\n",
    },
    { id: 'zap-panic', title: 'Go zap with a panic (float seconds)', input: "{\"level\":\"info\",\"ts\":1790935200.0412,\"caller\":\"server/main.go:57\",\"msg\":\"listening\",\"addr\":\":8080\"}\n{\"level\":\"warn\",\"ts\":1790935261.8873,\"caller\":\"payments/client.go:142\",\"msg\":\"retrying charge\",\"order_id\":48214,\"attempt\":2,\"backoff\":0.25}\npanic: runtime error: invalid memory address or nil pointer dereference\n[signal SIGSEGV: segmentation violation code=0x1 addr=0x18 pc=0x6b2f1c]\n\ngoroutine 87 [running]:\nexample.com/orders/payments.(*Client).Charge(0x0, {0x8c1f40, 0xc0001a2000}, 0xbc52)\n\t/src/payments/client.go:151 +0x3c\n", output: "{\"level\":\"info\",\"ts\":\"2026-10-02T10:00:00.041Z\",\"caller\":\"server/main.go:57\",\"msg\":\"listening\",\"addr\":\":8080\"}\n{\"level\":\"warn\",\"ts\":\"2026-10-02T10:01:01.887Z\",\"caller\":\"payments/client.go:142\",\"msg\":\"retrying charge\",\"order_id\":48214,\"attempt\":2,\"backoff\":0.25}\npanic: runtime error: invalid memory address or nil pointer dereference\n[signal SIGSEGV: segmentation violation code=0x1 addr=0x18 pc=0x6b2f1c]\n\ngoroutine 87 [running]:\nexample.com/orders/payments.(*Client).Charge(0x0, {0x8c1f40, 0xc0001a2000}, 0xbc52)\n\t/src/payments/client.go:151 +0x3c\n",
    },
    { id: 'python-json-logger', title: 'Python python-json-logger (float seconds)', input: "{\"created\":1791021600.512345,\"levelname\":\"INFO\",\"name\":\"worker.export\",\"lineno\":88,\"process\":3117,\"message\":\"export started\",\"job_id\":\"exp_20261003_01\",\"rows\":120000}\n{\"created\":1791021725.007912,\"levelname\":\"ERROR\",\"name\":\"worker.export\",\"lineno\":131,\"process\":3117,\"message\":\"export failed\",\"job_id\":\"exp_20261003_01\",\"duration_ms\":124496,\"retry_at\":1791022025}\n", output: "{\"created\":\"2026-10-03T10:00:00.512Z\",\"levelname\":\"INFO\",\"name\":\"worker.export\",\"lineno\":88,\"process\":3117,\"message\":\"export started\",\"job_id\":\"exp_20261003_01\",\"rows\":120000}\n{\"created\":\"2026-10-03T10:02:05.008Z\",\"levelname\":\"ERROR\",\"name\":\"worker.export\",\"lineno\":131,\"process\":3117,\"message\":\"export failed\",\"job_id\":\"exp_20261003_01\",\"duration_ms\":124496,\"retry_at\":\"2026-10-03T10:07:05.000Z\"}\n",
    },
  ],
}
export default recipe
