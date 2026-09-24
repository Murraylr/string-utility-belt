import type { Utility } from '@/types/utility'

/* -------------------------------------------------------------------------- */
/* randomness                                                                  */
/* -------------------------------------------------------------------------- */

/** Deterministic 32-bit PRNG — same seed always yields the same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function cryptoFloat(): number {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(1)
    c.getRandomValues(buf)
    return buf[0] / 4294967296
  }
  return Math.random()
}

/** seed === 0 ⇒ real randomness; any other seed ⇒ reproducible stream. */
function makeRng(seed: unknown): () => number {
  const s = Math.trunc(Number(seed) || 0)
  return s === 0 ? cryptoFloat : mulberry32(s)
}

/* -------------------------------------------------------------------------- */
/* token values                                                                */
/* -------------------------------------------------------------------------- */

const WORDS = [
  'alpha', 'amber', 'anchor', 'apple', 'arrow', 'aurora', 'basil', 'beacon', 'birch', 'bloom',
  'bramble', 'breeze', 'bright', 'canyon', 'cedar', 'cinder', 'citrus', 'clover', 'cobalt', 'comet',
  'copper', 'coral', 'crest', 'crimson', 'crystal', 'dahlia', 'delta', 'dune', 'ember', 'fable',
  'falcon', 'fern', 'flint', 'forest', 'fossil', 'garnet', 'glacier', 'granite', 'harbor', 'hazel',
  'heron', 'indigo', 'ivory', 'jasper', 'juniper', 'kestrel', 'lantern', 'lark', 'lily', 'lumen',
  'maple', 'marble', 'meadow', 'mesa', 'mint', 'nebula', 'nickel', 'nimbus', 'oak', 'onyx',
  'opal', 'orchid', 'otter', 'pebble', 'pepper', 'pilot', 'pine', 'prairie', 'quartz', 'quill',
  'raven', 'ridge', 'river', 'rowan', 'saffron', 'sage', 'sable', 'sienna', 'silver', 'slate',
  'solar', 'sparrow', 'spruce', 'summit', 'sunset', 'thistle', 'timber', 'topaz', 'tulip', 'umber',
  'valley', 'velvet', 'vertex', 'violet', 'walnut', 'willow', 'winter', 'zephyr'
]

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

function randHex(rng: () => number, length: number): string {
  let out = ''
  while (out.length < length) out += Math.floor(rng() * 16).toString(16)
  return out.slice(0, length)
}

function uuidV4(rng: () => number): string {
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(rng() * 256)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

/** A single-line text input cannot hold a real newline, so accept `\n`, `\t`, … */
function unescapeSeparator(s: string): string {
  return s.replace(/\\([nrt0\\])/g, (_m, c: string) => {
    switch (c) {
      case 'n': return '\n'
      case 'r': return '\r'
      case 't': return '\t'
      case '0': return '\0'
      default: return '\\'
    }
  })
}

function intParam(value: unknown, label: string): number {
  const n = Number(value)
  if (!Number.isFinite(n)) throw new Error(`${label} must be a number`)
  return Math.trunc(n)
}

const MAX_COUNT = 100000

// {name} or {name:arg} — anything else is left in the output untouched.
const TOKEN_RE = /\{([A-Za-z][A-Za-z0-9_]*)(?::([^{}]*))?\}/g

const util: Utility = {
  id: 'template_expand',
  name: 'template expand',
  category: 'Generators',
  description:
    'Repeat a template N times, substituting {i}, {i0}, {n}, {uuid}, {random}, {randint:a,b}, {word}, {hex:len}, {date} and {line} (the Nth input line).',
  accepts: 'string',
  produces: 'string',
  tags: ['template', 'mail merge', 'placeholder', 'generate rows', 'boilerplate', 'repeat text'],
  aliases: ['mustache'],
  examples: [
    {
      title: 'numbered rows',
      input: '',
      params: { template: 'row-{i}', count: 3 },
      output: 'row-1\nrow-2\nrow-3'
    },
    {
      title: 'seeded random integers',
      input: '',
      params: { template: '{i}: {randint:1,100}', count: 3, seed: 42 },
      output: '1: 61\n2: 45\n3: 86'
    }
  ],
  params: {
    template: {
      kind: 'textarea',
      label: 'template',
      default: '{i}, {uuid}',
      placeholder: '{i}, {uuid}'
    },
    count: { kind: 'number', label: 'count', default: 10, min: 0, max: MAX_COUNT, integer: true },
    start: { kind: 'number', label: 'start index', default: 1 },
    separator: { kind: 'string', label: 'separator', default: '\n' },
    seed: { kind: 'number', label: 'seed (0 = random)', default: 0 }
  },
  apply: (input: any, params: any = {}) => {
    const template = params.template === undefined || params.template === null
      ? '{i}, {uuid}'
      : String(params.template)

    const count = intParam(params.count ?? 10, 'count')
    if (count < 0) throw new Error('count must be 0 or more')
    if (count > MAX_COUNT) throw new Error(`count must be ${MAX_COUNT} or less`)

    const start = intParam(params.start ?? 1, 'start index')
    const separator = unescapeSeparator(
      params.separator === undefined || params.separator === null ? '\n' : String(params.separator)
    )
    const rng = makeRng(params.seed)

    if (count === 0) return ''

    const text = String(input ?? '')
    const lines = text.length ? text.split(/\r\n|\n|\r/) : []
    const now = new Date().toISOString()

    const rows: string[] = []
    for (let idx = 0; idx < count; idx++) {
      rows.push(
        template.replace(TOKEN_RE, (match, rawName: string, rawArg?: string) => {
          const name = rawName.toLowerCase()
          const arg = rawArg === undefined ? undefined : rawArg.trim()

          switch (name) {
            case 'i':
              return arg === undefined ? String(start + idx) : match
            case 'i0':
              return arg === undefined ? String(idx) : match
            case 'n':
              return arg === undefined ? String(count) : match
            case 'uuid':
              return arg === undefined ? uuidV4(rng) : match
            case 'random':
              return arg === undefined ? rng().toFixed(6) : match
            case 'word':
              return arg === undefined ? WORDS[Math.floor(rng() * WORDS.length)] : match
            case 'date':
              return arg === undefined ? now : match
            case 'line':
              return arg === undefined
                ? (lines.length ? lines[idx % lines.length] : '')
                : match
            case 'randint': {
              if (arg === undefined) return match
              const parts = arg.split(',').map((p) => Number(p.trim()))
              if (parts.length !== 2 || !parts.every((p) => Number.isFinite(p))) {
                throw new Error('{randint:a,b} needs two numbers, e.g. {randint:1,100}')
              }
              const lo = Math.min(Math.trunc(parts[0]), Math.trunc(parts[1]))
              const hi = Math.max(Math.trunc(parts[0]), Math.trunc(parts[1]))
              return String(randInt(rng, lo, hi))
            }
            case 'hex': {
              if (arg === undefined) return match
              const len = Number(arg)
              if (!Number.isFinite(len) || Math.trunc(len) < 1 || Math.trunc(len) > 4096) {
                throw new Error('{hex:len} needs a length between 1 and 4096')
              }
              return randHex(rng, Math.trunc(len))
            }
            default:
              return match
          }
        })
      )
    }

    return rows.join(separator)
  }
}

export default util
