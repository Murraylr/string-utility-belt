import { run } from '../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
const input = `{
  brand: {
    '50': '#eff6ff',
    '100': '#dbeafe',
    '500': '#3b82f6',
    '900': '#1e3a8a',
  },
  accent: '#f97316',
  'ink-muted': 'rgb(100 116 139)',
  transparent: 'transparent',
  current: 'currentColor',
}`
const S = toPipelineSteps([
  step('parse', 'json5_parse', { indent: 2 }, 'x x x x x x'),
  step('flat', 'json_flatten', { delimiter: '-', arrayNotation: 'dot', indent: 2 }, 'x x x x x x'),
  each('conv', { mode: 'json-values' }, [laneStep('cc', 'color_convert', { to: 'oklch', perLine: false, precision: 3 })], 'x x x x x x'),
  step('env', 'json_to_env', { upperCase: false, delimiter: '-', quote: 'never', exportPrefix: false }, 'x x x x x x'),
  step('css', 'replace', { pattern: '^([^=]+)=(.*)$', replacement: '--color-$1: $2;', regex: true, flags: 'gm' }, 'x x x x x x'),
])
const r = await run(input, S); console.log(r.out, r.errors)
