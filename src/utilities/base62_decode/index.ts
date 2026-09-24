import type { Utility } from '@/types/utility'

const DIGITS = '0123456789'
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const LOWER = 'abcdefghijklmnopqrstuvwxyz'

const ALPHABETS: Record<string, string> = {
  standard: DIGITS + UPPER + LOWER,
  inverted: DIGITS + LOWER + UPPER
}

/** Base62 is case-sensitive — the two alphabets differ only by letter case. */
const MAPS: Record<string, Map<string, number>> = {}
function lookupFor(name: string): { alphabet: string; map: Map<string, number> } {
  const alphabet = Object.prototype.hasOwnProperty.call(ALPHABETS, name) ? ALPHABETS[name] : undefined
  if (!alphabet) throw new Error(`unknown base62 alphabet: "${name}"`)
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

/** Inverse of base62Encode: big-integer accumulate, then re-attach the leading zero bytes. */
function base62Decode(text: string, alphabet: string, map: Map<string, number>): Uint8Array {
  const clean = text.replace(/\s+/g, '')
  if (!clean) return new Uint8Array(0)

  const base = BigInt(alphabet.length)
  let num = 0n
  for (const ch of clean) {
    const idx = map.get(ch)
    if (idx === undefined) throw new Error(`invalid base62 character: "${ch}"`)
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
  id: 'base62_decode',
  name: 'base62 decode',
  category: 'Decoding',
  description:
    'Decode Base62 (standard or inverted alphabet) back to text or raw bytes, restoring leading zero bytes.',
  accepts: 'string',
  produces: ['string', 'bytes'],
  params: {
    alphabet: {
      kind: 'select',
      label: 'alphabet',
      options: ['standard', 'inverted'],
      default: 'standard'
    },
    output: { kind: 'select', label: 'output', options: ['text', 'bytes'], default: 'text' }
  },
  tags: ['base62', 'decode', 'alphanumeric', 'url shortener', 'binary'],
  examples: [
    {
      title: 'standard alphabet',
      input: '73XpUgyMwkGr29M',
      output: 'Hello World'
    }
  ],
  apply: (input: any, params: any) => {
    const { alphabet, map } = lookupFor(params?.alphabet || 'standard')
    const bytes = base62Decode(toText(input), alphabet, map)
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
