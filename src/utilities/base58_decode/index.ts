import type { Utility } from '@/types/utility'

const ALPHABETS: Record<string, string> = {
  bitcoin: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
  ripple: 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz',
  flickr: '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ'
}

/** Base58 is case-sensitive, so the lookup is built verbatim. */
const MAPS: Record<string, Map<string, number>> = {}
function lookupFor(name: string): { alphabet: string; map: Map<string, number> } {
  const alphabet = Object.prototype.hasOwnProperty.call(ALPHABETS, name) ? ALPHABETS[name] : undefined
  if (!alphabet) throw new Error(`unknown base58 alphabet: "${name}"`)
  let map = MAPS[name]
  if (!map) {
    map = new Map<string, number>()
    for (let i = 0; i < alphabet.length; i++) map.set(alphabet[i], i)
    MAPS[name] = map
  }
  return { alphabet, map }
}

const isBytes = (v: any): v is Uint8Array =>
  v instanceof Uint8Array || (!!v && typeof v === 'object' && v[Symbol.toStringTag] === 'Uint8Array')

const toText = (input: any): string =>
  isBytes(input) ? new TextDecoder().decode(input) : input == null ? '' : String(input)

/** Inverse of base58Encode: big-integer accumulate, then re-attach the leading zero bytes. */
function base58Decode(text: string, alphabet: string, map: Map<string, number>): Uint8Array {
  const clean = text.replace(/\s+/g, '')
  if (!clean) return new Uint8Array(0)

  const base = BigInt(alphabet.length)
  let num = 0n
  for (const ch of clean) {
    const idx = map.get(ch)
    if (idx === undefined) throw new Error(`invalid base58 character: "${ch}"`)
    num = num * base + BigInt(idx)
  }

  const out: number[] = []
  while (num > 0n) {
    out.unshift(Number(num & 0xffn))
    num >>= 8n
  }

  for (const ch of clean) {
    if (ch !== alphabet[0]) break
    out.unshift(0)
  }
  return new Uint8Array(out)
}

const util: Utility = {
  id: 'base58_decode',
  name: 'base58 decode',
  category: 'Decoding',
  description:
    'Decode Base58 (Bitcoin, Ripple, or Flickr alphabet) back to text or raw bytes, restoring leading zero bytes.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  params: {
    alphabet: {
      kind: 'select',
      label: 'alphabet',
      options: ['bitcoin', 'ripple', 'flickr'],
      default: 'bitcoin'
    },
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  tags: ['base58', 'decode', 'bitcoin', 'ripple', 'flickr', 'binary', 'wallet address'],
  examples: [
    {
      title: 'bitcoin alphabet',
      input: 'StV1DL6CwTryKyV',
      output: 'hello world'
    }
  ],
  apply: (input: any, params: any) => {
    const { alphabet, map } = lookupFor(params?.alphabet || 'bitcoin')
    const bytes = base58Decode(toText(input), alphabet, map)
    if ((params?.output || 'text') === 'bytes') return bytes
    if (bytes.length === 0) return ''
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new Error('decoded bytes are not valid UTF-8 text — set output to "bytes"')
    }
  }
}

export default util
