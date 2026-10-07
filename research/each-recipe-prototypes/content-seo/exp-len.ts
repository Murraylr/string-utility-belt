import { run } from '../harness'
import { sanitizeSteps } from '/home/user/string-utility-belt/src/core/serialize'
let n = 0
const s = (utilityId: string, params: any = {}, extra: any = {}) => ({ id: `${utilityId}-${n++}`, utilityId, enabled: true, params, ...extra })
const each = (steps: any[], split: any = { mode: 'lines' }) => ({ id: `e${n++}`, type: 'each', enabled: true, split, skipEmpty: true, steps })
const branch = (lanes: any[][], merge: any) => ({ id: `b${n++}`, type: 'branch', enabled: true, branches: lanes, merge })
const titles = [
  'Home | Example Outdoor Co.',
  'Waterproof Hiking Boots for Men & Women – Free Returns | Example Outdoor Co.',
  'How to Choose a Sleeping Bag: Temperature Ratings, Fill Power and Fit Explained',
  '',
  'Contact Us',
  'Trail Running Shoes – Example Outdoor Co.',
  '🎒 Backpacks on Sale',
].join('\n')
const v1 = [each([branch([[s('length')], []], { mode: 'concat', separator: ' · ' })])]
console.log('v1\n' + (await run(titles, v1)).out)
const OVER = String.raw`^(6[1-9]|[7-9]\d|\d{3,})$`
const v2 = [each([branch([[s('length'), s('line_affix', { suffix: ' ⚠' }, { condition: { kind: 'regex', pattern: OVER } })], []], { mode: 'concat', separator: ' · ' })])]
console.log('v2\n' + (await run(titles, v2)).out)
const v3 = [each([branch([[s('length'), s('pad', { length: 3, char: ' ', side: 'start' })], []], { mode: 'concat', separator: '  ' }),
  s('line_affix', { prefix: '⚠ ' }, { condition: { kind: 'regex', pattern: String.raw`^\s*(6[1-9]|[7-9]\d|\d{3,})  ` } })])]
console.log('v3\n' + (await run(titles, v3)).out)
const v4 = [each([branch([[s('length')], []], { mode: 'concat', separator: '\t' })])]
console.log('v4 (tsv)\n' + JSON.stringify((await run(titles, v4)).out))
console.log('sanitize keeps empty lane:', JSON.stringify(sanitizeSteps(v1 as any)) === JSON.stringify(v1))
console.log(JSON.stringify(sanitizeSteps(v1 as any)))
