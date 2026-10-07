import { run } from '../harness'
for (const [inp, p] of [['1286536308.779', { to: 'iso' }], ['1286536308', { to: 'iso' }], ['1286536308779', { to: 'iso' }], ['1286536308.779', { to: 'sql' }], ['1364481363.243', { to: 'iso', timezone: 'UTC' }]] as const) {
  const r = await run(inp, [{ id: 't', utilityId: 'timestamp_convert', enabled: true, params: p } as any])
  console.log(inp, JSON.stringify(p), '=>', JSON.stringify(r.out), JSON.stringify(r.errors))
}
