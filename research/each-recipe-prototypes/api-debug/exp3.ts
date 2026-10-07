import { show, U, E } from './util'
import recipe from './ts-recipe'
const COND = { kind: 'regex', pattern: '^1[2-9]\\d{8}(?:\\d{3})?(?:\\.\\d+)?$', flags: '' }
// 1) no condition: what would convert?
await show('NO CONDITION on orders-list', recipe.samples[0].input, [
  U('flat', 'json_flatten', {}),
  E('each', { mode: 'json-values' }, [U('ts', 'timestamp_convert', { to: 'iso' })]),
  U('unflat', 'json_unflatten', {}),
])
// 2) nested each without flatten: array of records -> each element -> each value
await show('nested each on top-level array', recipe.samples[1].input, [
  E('rows', { mode: 'json-array' }, [E('vals', { mode: 'json-values' }, [U('ts', 'timestamp_convert', { to: 'iso' }, { condition: COND })])]),
])
// 3) nested each on {"data":[...]} shape: must special-case keys
await show('nested each on {data:[...]}', recipe.samples[0].input, [
  E('top', { mode: 'json-values' }, [E('rows', { mode: 'json-array' }, [E('vals', { mode: 'json-values' }, [U('ts', 'timestamp_convert', { to: 'iso' }, { condition: COND })])], { condition: { kind: 'regex', pattern: '^\\[' } })]),
])
