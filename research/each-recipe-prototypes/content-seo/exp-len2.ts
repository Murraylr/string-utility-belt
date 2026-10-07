import { run } from '../harness'
let n = 0
const s = (utilityId: string, params: any = {}, extra: any = {}) => ({ id: `${utilityId}-${n++}`, utilityId, enabled: true, params, ...extra })
for (const t of ['🎒 Backpacks on Sale', 'Café Guide', '👩‍👩‍👧 Family Plans', '']) {
  const r = await run(t, [s('text_stats'), s('jsonpath', { path: '$.graphemes', mode: 'first', indent: 2 })])
  const l = await run(t, [s('length')])
  console.log(JSON.stringify(t), 'graphemes:', JSON.stringify(r.out), 'length:', l.out, r.errors)
}
