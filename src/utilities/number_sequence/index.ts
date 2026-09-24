import type { Utility } from '@/types/utility'

const MAX_VALUES = 100000

/** Let a user type `\n` / `\t` into the single-line separator box and mean the control character. */
function decodeEscapes(s: string): string {
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

/** Decimal places in a number's shortest string form, so 0.1 steps do not drift. */
function decimalsOf(n: number): number {
  const s = String(n)
  if (s.indexOf('e') >= 0 || s.indexOf('E') >= 0) return 12
  const dot = s.indexOf('.')
  return dot < 0 ? 0 : s.length - dot - 1
}

const util: Utility = {
  id: 'number_sequence',
  name: 'number sequence',
  category: 'Generators',
  description:
    'Generate a numeric sequence from start to end by a step, with a radix, zero padding, prefix, suffix, and separator.',
  accepts: 'string',
  produces: 'string',
  tags: ['range', 'sequence', 'counter', 'list numbers', 'enumerate', 'incrementing numbers'],
  aliases: ['seq'],
  examples: [
    {
      title: 'simple range',
      input: '',
      params: { start: 1, end: 5, step: 1 },
      output: '1\n2\n3\n4\n5'
    },
    {
      title: 'zero-padded hex with a prefix',
      input: '',
      params: { start: 0, end: 3, step: 1, radix: 16, pad: 2, prefix: '0x' },
      output: '0x00\n0x01\n0x02\n0x03'
    }
  ],
  params: {
    start: { kind: 'number', label: 'start', default: 1 },
    end: { kind: 'number', label: 'end', default: 10 },
    step: { kind: 'number', label: 'step', default: 1 },
    pad: { kind: 'number', label: 'zero pad width', default: 0, min: 0, integer: true },
    prefix: { kind: 'string', label: 'prefix', default: '' },
    suffix: { kind: 'string', label: 'suffix', default: '' },
    // a real newline in a single-line <input> is stripped by the browser's value
    // sanitiser, so the box would render blank; ship the escape the field can display
    separator: { kind: 'string', label: 'separator', default: '\\n' },
    radix: { kind: 'number', label: 'radix', default: 10, min: 2, max: 36, integer: true }
  },
  apply: (_input: any, p: any) => {
    const params = p ?? {}
    const start = Number(params.start ?? 1)
    const end = Number(params.end ?? 10)
    const step = Number(params.step ?? 1)
    const pad = Math.floor(Number(params.pad ?? 0))
    const prefix = params.prefix == null ? '' : String(params.prefix)
    const suffix = params.suffix == null ? '' : String(params.suffix)
    const separator = decodeEscapes(params.separator == null ? '\\n' : String(params.separator))
    const radix = Math.floor(Number(params.radix ?? 10))

    if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(step)) {
      throw new Error('start, end and step must be finite numbers')
    }
    if (step === 0) throw new Error('step must not be zero')
    if (!Number.isFinite(radix) || radix < 2 || radix > 36) {
      throw new Error('radix must be between 2 and 36')
    }
    if (!Number.isFinite(pad) || pad < 0) throw new Error('zero pad width must be zero or more')
    if ((end > start && step < 0) || (end < start && step > 0)) {
      throw new Error(`step ${step} moves away from end ${end}`)
    }

    const total = Math.floor((end - start) / step + 1e-9) + 1
    if (total > MAX_VALUES) throw new Error(`sequence would produce ${total} values (limit ${MAX_VALUES})`)

    const decimals = Math.min(12, Math.max(decimalsOf(start), decimalsOf(step)))

    const out: string[] = []
    for (let i = 0; i < total; i++) {
      const value = Number((start + i * step).toFixed(decimals))
      const negative = value < 0
      const abs = Math.abs(value)
      let digits: string
      if (radix === 10) {
        digits = decimals > 0 ? abs.toFixed(decimals) : String(abs)
      } else {
        if (!Number.isInteger(abs)) throw new Error(`radix ${radix} requires whole numbers`)
        digits = abs.toString(radix)
      }
      if (pad > 0) digits = digits.padStart(pad, '0')
      out.push(prefix + (negative ? '-' : '') + digits + suffix)
    }
    return out.join(separator)
  }
}

export default util
