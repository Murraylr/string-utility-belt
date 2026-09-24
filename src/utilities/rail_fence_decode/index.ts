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

/** Index of the rail each plaintext position occupies, walking the zigzag from `offset`. */
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
  id: 'rail_fence_decode',
  name: 'rail fence decode',
  category: 'Ciphers',
  description:
    'Decode rail fence (zigzag) transposition ciphertext using the same number of rails and starting offset that produced it.',
  accepts: 'string',
  produces: 'string',
  tags: ['cipher', 'zigzag', 'decrypt', 'decode', 'transposition', 'classical', 'rails'],
  examples: [
    {
      title: 'decode with 3 rails',
      input: 'WECRLTEERDSOEEFEAOCAIVDEN',
      params: { rails: 3, offset: 0 },
      output: 'WEAREDISCOVEREDFLEEATONCE'
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

    // `order[k]` is the plaintext position of the k-th ciphertext character:
    // the encoder emits positions bucketed by rail, each rail in plaintext order.
    // A stable index sort avoids allocating per-rail arrays, so a large `rails`
    // value costs O(n log n) time rather than O(rails) memory.
    const order = chars.map((_, i) => i).sort((a, b) => seq[a] - seq[b] || a - b)

    const out: string[] = new Array(chars.length)
    for (let k = 0; k < order.length; k++) out[order[k]] = chars[k]
    return out.join('')
  }
}

export default util
