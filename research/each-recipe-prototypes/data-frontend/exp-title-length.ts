import { run } from '../harness'
const input = 'Hash an Email List for Customer Match | Example Store\nBuy Merino Wool Socks Online — Free Shipping on Orders Over $50 | Example Store\nContact Us\n'
const each = { id: 'e', type: 'each', enabled: true, split: { mode: 'lines' }, skipEmpty: true, steps: [
  { id: 'b', type: 'branch', enabled: true, branches: [[{ id: 'len', utilityId: 'length', enabled: true, params: {} }], []], merge: { mode: 'concat', separator: '  ' } },
] } as any
console.log((await run(input, [each])).out)
console.log('--- filter_lines_by_length min 61 (no each):')
console.log((await run(input, [{ id: 'f', utilityId: 'filter_lines_by_length', enabled: true, params: { min: 61 } } as any])).out)
