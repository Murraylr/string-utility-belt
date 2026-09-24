import type { Utility } from '@/types/utility'

type Operation =
  | 'and'
  | 'or'
  | 'xor'
  | 'not'
  | 'shift-left'
  | 'shift-right'
  | 'unsigned-shift-right'
  | 'rotate-left'
  | 'rotate-right'
  | 'popcount'
  | 'reverse-bits'

const OPERATIONS: Operation[] = [
  'and',
  'or',
  'xor',
  'not',
  'shift-left',
  'shift-right',
  'unsigned-shift-right',
  'rotate-left',
  'rotate-right',
  'popcount',
  'reverse-bits'
]

const SHIFT_OPS = new Set<Operation>([
  'shift-left',
  'shift-right',
  'unsigned-shift-right',
  'rotate-left',
  'rotate-right'
])

const WIDTHS = [8, 16, 32, 64]
const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** Parse an integer of arbitrary radix into a BigInt. `radix` 0 auto-detects (0x/0b/0o, else decimal). */
export function parseInteger(raw: string, radix: number, label: string): bigint {
  let text = raw.replace(/[\s_]/g, '')
  let negative = false
  if (text.startsWith('+')) text = text.slice(1)
  else if (text.startsWith('-')) {
    negative = true
    text = text.slice(1)
  }
  if (!text) throw new Error(`${label} is empty`)

  let base = radix
  const prefix = /^0([bxo])(.*)$/i.exec(text)
  // Under an explicit radix the prefix letter may be a legitimate digit — `0b1a` is plain hex at
  // radix 16 — so only read it as a prefix when it cannot be a digit in that radix.
  const letter = prefix ? prefix[1].toLowerCase() : ''
  const letterIsDigit = Boolean(prefix) && base > 0 && DIGITS.indexOf(letter) < base
  if (prefix && !letterIsDigit) {
    const prefixBase = letter === 'b' ? 2 : letter === 'o' ? 8 : 16
    if (base && base !== prefixBase) {
      throw new Error(`${label} "${raw.trim()}" uses a 0${letter} prefix but input radix is ${base}`)
    }
    base = prefixBase
    text = prefix[2]
  }
  if (!base) base = 10
  if (!text) throw new Error(`${label} "${raw.trim()}" has no digits`)

  let out = 0n
  const bigBase = BigInt(base)
  for (const ch of text) {
    const digit = DIGITS.indexOf(ch.toLowerCase())
    if (digit < 0 || digit >= base) {
      throw new Error(`invalid digit "${ch}" for radix ${base} in ${label} "${raw.trim()}"`)
    }
    out = out * bigBase + BigInt(digit)
  }
  return negative ? -out : out
}

/** Format an unsigned BigInt, zero-padding to the full width for power-of-two radixes. */
export function formatInteger(value: bigint, radix: number, width: number): string {
  const text = value.toString(radix)
  const bitsPerDigit = Math.log2(radix)
  if (Number.isInteger(bitsPerDigit)) return text.padStart(Math.ceil(width / bitsPerDigit), '0')
  return text
}

const popcount = (value: bigint) => {
  let count = 0
  let rest = value
  while (rest > 0n) {
    if (rest & 1n) count++
    rest >>= 1n
  }
  return count
}

const reverseBits = (value: bigint, width: number) => {
  let out = 0n
  let rest = value
  for (let i = 0; i < width; i++) {
    out = (out << 1n) | (rest & 1n)
    rest >>= 1n
  }
  return out
}

const util: Utility = {
  id: 'bit_ops',
  name: 'bit operations',
  category: 'Numbers',
  description:
    'Apply bitwise and, or, xor, not, shifts, rotates, popcount, or bit reversal to integers at 8/16/32/64-bit width, with configurable input and output radix; popcount reports a decimal count.',
  accepts: 'string',
  produces: 'string',
  params: {
    operation: {
      kind: 'select',
      label: 'operation',
      options: OPERATIONS as string[],
      default: 'and'
    },
    operand: {
      kind: 'string',
      label: 'operand (shift/rotate amount is a decimal count)',
      default: '0'
    },
    width: {
      kind: 'select',
      label: 'width (bits)',
      options: ['8', '16', '32', '64'],
      default: '32'
    },
    inputRadix: {
      kind: 'number',
      label: 'input radix (0 = auto-detect)',
      default: 0,
      min: 0,
      max: 36,
      integer: true
    },
    outputRadix: {
      kind: 'number',
      label: 'output radix',
      default: 2,
      min: 2,
      max: 36,
      integer: true
    },
    perLine: {
      kind: 'boolean',
      label: 'each line / whitespace-separated value separately',
      default: true
    }
  },
  tags: ['bitwise', 'and or xor', 'shift', 'rotate', 'popcount', 'bit manipulation', 'bit twiddling'],
  examples: [
    { title: 'bitwise AND', input: '1010', params: { operation: 'and', operand: '1100', width: '8', outputRadix: 2 }, output: '01000000' },
    { title: 'shift left', input: '5', params: { operation: 'shift-left', operand: '2', width: '8', inputRadix: 10, outputRadix: 10 }, output: '20' }
  ],
  apply: (input: any, params: any) => {
    const raw = String(input ?? '')
    if (!raw.trim()) return ''

    const operation: Operation = OPERATIONS.includes(params?.operation) ? params.operation : 'and'
    const width = WIDTHS.includes(Number(params?.width)) ? Number(params.width) : 32
    const inputRadix = params?.inputRadix === undefined || params.inputRadix === null ? 0 : Number(params.inputRadix)
    const outputRadix = params?.outputRadix === undefined || params.outputRadix === null ? 2 : Number(params.outputRadix)
    const perLine = params?.perLine !== false

    if (!Number.isInteger(inputRadix) || inputRadix === 1 || inputRadix < 0 || inputRadix > 36) {
      throw new Error('input radix must be 0 (auto) or between 2 and 36')
    }
    if (!Number.isInteger(outputRadix) || outputRadix < 2 || outputRadix > 36) {
      throw new Error('output radix must be between 2 and 36')
    }

    const bigWidth = BigInt(width)
    const mask = (1n << bigWidth) - 1n
    const operandText = String(params?.operand ?? '').trim()

    let operand = 0n
    let amount = 0n
    if (SHIFT_OPS.has(operation)) {
      // Shift and rotate amounts are plain counts: decimal unless explicitly prefixed.
      amount = operandText ? parseInteger(operandText, 0, 'shift amount') : 0n
      if (amount < 0n) throw new Error('shift amount must not be negative')
    } else {
      operand = (operandText ? parseInteger(operandText, inputRadix, 'operand') : 0n) & mask
    }

    const convert = (token: string): string => {
      const value = parseInteger(token, inputRadix, 'value') & mask

      switch (operation) {
        case 'and':
          return formatInteger(value & operand, outputRadix, width)
        case 'or':
          return formatInteger(value | operand, outputRadix, width)
        case 'xor':
          return formatInteger(value ^ operand, outputRadix, width)
        case 'not':
          return formatInteger(~value & mask, outputRadix, width)
        case 'popcount':
          return String(popcount(value))
        case 'reverse-bits':
          return formatInteger(reverseBits(value, width), outputRadix, width)
        case 'shift-left': {
          const n = amount > bigWidth ? bigWidth : amount
          return formatInteger((value << n) & mask, outputRadix, width)
        }
        case 'unsigned-shift-right': {
          const n = amount > bigWidth ? bigWidth : amount
          return formatInteger(value >> n, outputRadix, width)
        }
        case 'shift-right': {
          const n = amount > bigWidth ? bigWidth : amount
          const signed = (value >> (bigWidth - 1n)) & 1n ? value - (1n << bigWidth) : value
          return formatInteger((signed >> n) & mask, outputRadix, width)
        }
        case 'rotate-left': {
          const n = amount % bigWidth
          return formatInteger(((value << n) | (value >> (bigWidth - n))) & mask, outputRadix, width)
        }
        case 'rotate-right': {
          const n = amount % bigWidth
          return formatInteger(((value >> n) | (value << (bigWidth - n))) & mask, outputRadix, width)
        }
        default: {
          const never: never = operation
          throw new Error(`unsupported operation: ${String(never)}`)
        }
      }
    }

    if (!perLine) return convert(raw)

    return raw
      .split(/\r?\n/)
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed) return ''
        return trimmed.split(/\s+/).map(convert).join(' ')
      })
      .join('\n')
  }
}

export default util
