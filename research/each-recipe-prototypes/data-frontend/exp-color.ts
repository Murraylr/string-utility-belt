import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step, branch } from '/home/user/string-utility-belt/src/recipes/define'

const lane = (id: string, bg: string, prefix: string) => [
  laneStep(`${id}-c`, 'color_contrast', { foreground: '', background: bg }),
  laneStep(`${id}-s`, 'jsonpath', { path: '$.summary', mode: 'first', indent: 2 }),
  laneStep(`${id}-p`, 'line_affix', { prefix, suffix: '', skipBlank: true, joinWith: '' }),
]
const steps = toPipelineSteps([
  each('per-color', { mode: 'lines' }, [
    { id: 'br', type: 'branch', enabled: true, branches: [[], lane('w', '#ffffff', 'on white: '), lane('k', '#000000', 'on black: ')], merge: { mode: 'concat', separator: '  |  ' } } as any,
  ], 'x x x x x x'),
])
const inputs = [
  '#1a73e8\n#d93025\n#188038\n#f9ab00\n#5f6368\n',
  'rebeccapurple\nrgb(0 0 0 / 50%)\noklch(0.6 0.15 250)\nnot-a-color\n\n#12\n',
]
for (const i of inputs) {
  const r = await run(i, steps)
  console.log(r.out, JSON.stringify(r.errors))
}
// ratio only
const steps2 = toPipelineSteps([
  each('per-color', { mode: 'lines' }, [
    { id: 'br', type: 'branch', enabled: true, branches: [[],
      [laneStep('w1', 'color_contrast', { background: '#ffffff' }), laneStep('w2', 'jsonpath', { path: '$.ratio', mode: 'first' })],
      [laneStep('k1', 'color_contrast', { background: '#000000' }), laneStep('k2', 'jsonpath', { path: '$.ratio', mode: 'first' })],
    ], merge: { mode: 'concat', separator: '\t' } } as any,
  ], 'x x x x x x'),
])
console.log((await run(inputs[0], steps2)).out)
