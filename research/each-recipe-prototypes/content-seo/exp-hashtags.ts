import { run } from '../harness'
let n = 0
const s = (utilityId: string, params: any = {}, extra: any = {}) => ({ id: `${utilityId}-${n++}`, utilityId, enabled: true, params, ...extra })
const each = (steps: any[], split: any = { mode: 'lines' }) => ({ id: `e${n++}`, type: 'each', enabled: true, split, skipEmpty: true, steps })
const phrases = ['mother’s day gift ideas', 'SEO tips 2026', 'black friday deals', 'rock & roll', 'iPhone photography', 'café culture', 'accessibility matters', '', 'Women in STEM'].join('\n')
console.log('format_case whole:', JSON.stringify((await run(phrases, [s('format_case', { mode: 'pascal' })])).out))
const A = [s('multi_replace', { rules: [["'", ''], ['’', ''], ['&', ' and ']], regex: false, ignoreCase: false, applyOnce: false }), each([s('format_case', { mode: 'pascal' })]), s('line_affix', { prefix: '#', skipBlank: true })]
console.log('A each+pascal:\n' + (await run(phrases, A)).out)
const SED = [String.raw`s/['’]//g`, String.raw`s/&/ and /g`, String.raw`s/(^|[^\p{L}\p{N}])(\p{Ll})/\1\u\2/g`, String.raw`s/[^\p{L}\p{N}]//g`, String.raw`/./ s/^/#/`].join('\n')
const B = [s('sed', { script: SED })]
const r = await run(phrases, B)
console.log('B sed only:\n' + r.out, r.errors)
