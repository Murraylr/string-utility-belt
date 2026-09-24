import type { Utility } from '@/types/utility'

function readRails(params: any): number {
  const raw = params?.rails
  const rails = raw === undefined || raw === null || raw === '' ? 3 : Number(raw)
  if (!Number.isFinite(rails) || !Number.isInteger(rails)) {
    throw new Error('rails must be a whole number')
  }
  if (rails < 1) throw new Error('rails must be at least 1')
  return rails
}

function readOffset(params: any): number {
  const raw = params?.offset
  const offset = raw === undefined || raw === null || raw === '' ? 0 : Number(raw)
  if (!Number.isFinite(offset) || !Number.isInteger(offset)) {
    throw new Error('offset must be a whole number')
  }
  return offset
}

/**
 * Index of the rail each character lands on, walking the zigzag from `offset`.
 * Works on code points so astral characters stay intact.
 */
function railSequence(length: number, rails: number, offset: number): number[] {
  const cycle = 2 * rails - 2
  let pos = ((offset % cycle) + cycle) % cycle
  const out: number[] = new Array(length)
  for (let i = 0; i < length; i++) {
    out[i] = pos < rails ? pos : cycle - pos
    pos = (pos + 1) % cycle
  }
  return out
}

const util: Utility = {
  id: 'rail_fence_encode',
  name: 'rail fence encode',
  category: 'Ciphers',
  description:
    'Encode text with the rail fence (zigzag) transposition cipher across a chosen number of rails, with an optional starting offset into the zigzag.',
  accepts: 'string',
  produces: 'string',
  tags: ['cipher', 'zigzag', 'encrypt', 'encode', 'transposition', 'classical', 'rails'],
  examples: [
    {
      title: 'encode with 3 rails',
      input: 'WEAREDISCOVEREDFLEEATONCE',
      params: { rails: 3, offset: 0 },
      output: 'WECRLTEERDSOEEFEAOCAIVDEN'
    }
  ],
  params: {
    rails: { kind: 'number', label: 'rails', default: 3, min: 1, integer: true, max: 10000 },
    offset: { kind: 'number', label: 'offset', default: 0 }
  },
  apply: (input: any, params: any) => {
    const rails = readRails(params)
    const offset = readOffset(params)
    const chars = Array.from(String(input ?? ''))
    if (chars.length === 0) return ''
    if (rails === 1) return chars.join('')

    const seq = railSequence(chars.length, rails, offset)

    // Read order: characters bucketed by rail, each rail keeping plaintext order.
    // A stable index sort is used instead of one array per rail so that a large
    // `rails` value costs O(n log n) time rather than O(rails) memory — `rails`
    // is a free-form number input and the pipeline re-runs on every keystroke.
    const order = chars.map((_, i) => i).sort((a, b) => seq[a] - seq[b] || a - b)
    return order.map((i) => chars[i]).join('')
  }
}

export default util
