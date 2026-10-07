import { run } from '../harness'
const r = await run('10 Tips for Better Sleep\nCafé Crème: A Guide\n東京ガイド\nRésumé Tips\nRésumé Tips\n', [{ id: 'm', type: 'each', enabled: true, split: { mode: 'lines' }, skipEmpty: true, steps: [{ id: 's', utilityId: 'slug', enabled: true, params: {} }] } as any])
console.log(JSON.stringify(r.out), r.errors)
const w = await run('10 Tips for Better Sleep\nCafé Crème: A Guide\n', [{ id: 's', utilityId: 'slug', enabled: true, params: {} } as any])
console.log('whole:', JSON.stringify(w.out))
