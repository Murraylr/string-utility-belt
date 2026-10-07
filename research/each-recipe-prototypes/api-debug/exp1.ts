import { show, U, E } from './util'
const COND = { kind: 'regex', pattern: '^1[2-9]\\d{8}(?:\\d{3})?(?:\\.\\d+)?$', flags: '' }
const steps = [
  U('flat', 'json_flatten', {}),
  E('each', { mode: 'json-values' }, [U('ts', 'timestamp_convert', { to: 'iso', perLine: false }, { condition: COND })]),
  U('unflat', 'json_unflatten', {}),
]
await show('nested object', JSON.stringify({ data: [{ id: 4821, created: 1759312800, phone: 4155550123, updated_ms: 1759316400123, size: 1073741824, name: 'a.b', 'x.y': 1700000000 }], has_more: false, meta: { generated_at: 1759320000.25, count: 2 } }), steps)
await show('top-level array', JSON.stringify([{ id: 1, ts: 1759312800 }, { id: 2, ts: '1759312801' }, []]), steps)
await show('empty array', '[]', steps)
await show('scalars', '{"a":null,"b":true,"c":"","d":{}}', steps)
// direct each on nested (no flatten)
await show('no flatten', JSON.stringify({ data: [{ created: 1759312800 }], t: 1759312800 }), [steps[1], steps[2]])
