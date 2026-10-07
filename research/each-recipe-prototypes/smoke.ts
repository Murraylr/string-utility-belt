import { proto, run } from './harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import STATIC from '/home/user/string-utility-belt/src/recipes/decode-kubernetes-secret/recipe'

// a shipped recipe must come back clean (proves the harness reports no false problems)
await proto(STATIC)

// a draft with blank outputs must report the sample mismatch and print the actual output
await proto({
  slug: 'harness-smoke-draft',
  name: 'Harness smoke draft',
  summary: 'Uppercases every line, then trims it, to prove the harness runs drafts.',
  category: 'Writing & Marketing',
  primaryQuery: 'harness smoke draft query',
  published: '2026-10-08',
  steps: [
    each('per-line', { mode: 'lines' }, [laneStep('up', 'case', { mode: 'upper' })], 'Uppercases each line.'),
    step('trim', 'trim', {}, 'Trims the whole text.'),
  ],
  samples: [
    { id: 'a', title: 'A', input: ' ab\ncd \n', output: '' },
    { id: 'b', title: 'B', input: 'x', output: '' },
  ],
})
console.log('\nrun():', JSON.stringify((await run('a\nb', [{ id: 'e', type: 'each', enabled: true, split: { mode: 'lines' }, steps: [{ id: 'u', utilityId: 'case', enabled: true, params: { mode: 'upper' } }] } as any])).out))
