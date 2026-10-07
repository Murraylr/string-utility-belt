import { show, U, E } from './util'
const COND = { kind: 'regex', pattern: '^1[2-9]\\d{8}(?:\\d{3})?(?:\\.\\d+)?$', flags: '' }
const steps = [
  U('flat', 'json_flatten', {}),
  E('each', { mode: 'json-values' }, [U('ts', 'timestamp_convert', { to: 'iso', timezone: 'UTC' }, { condition: COND })]),
  U('unflat', 'json_unflatten', {}),
]
console.log(new Date(1200000000e3).toISOString(), new Date(1999999999e3).toISOString(), new Date(1200000000000).toISOString())
await show('BOM', '﻿{"t":1759312800}', steps)
await show('CRLF pretty', '{\r\n  "t": 1759312800,\r\n  "n": "x"\r\n}\r\n', steps)
await show('bigint', '{"id": 9007199254740993, "t": 1759312800}', steps)
await show('unicode keys', '{"créé_le": 1759312800, "名前": "テスト", "emoji🙂": "1759312800"}', steps)
await show('microseconds + ns', '{"us": 1759312800123456, "ns": 1759312800123456789, "neg": -1759312800, "exp": 1.7593128e9}', steps)
await show('invalid', '{"t": 1759312800,}', steps)
await show('slack ts string', '{"ts":"1759312800.000200","thread_ts":"1759312800.000200"}', steps)
await show('key with brackets and quote', `{"a[0]": 1759312800, "it's": 1759312800, "": 1759312800, "0": 1}`, steps)
