import type { Utility } from '@/types/utility'
import { isBytes, textToUint8Array } from '../helpers'

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\' }

/** Let users type `\n` / `\t` (or `\\` for a literal backslash) into the separator field. */
const unescapeSeparator = (raw: unknown, fallback: string): string => {
  if (raw === undefined || raw === null) return fallback
  return String(raw).replace(/\\([ntr0\\])/g, (_m, c: string) => ESCAPES[c])
}

const toBytes = (input: unknown): Uint8Array =>
  isBytes(input) ? input : textToUint8Array(String(input ?? ''))

const util: Utility = {
  id: 'octal_encode',
  name: 'octal encode',
  category: 'Encoding',
  description: 'Convert text or bytes to zero-padded octal triples joined by a custom separator.',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['octal', 'base8', 'bytes', 'escape', 'encode', 'chmod', 'unix permissions'],
  examples: [
    { title: 'default separator', input: 'Hi!', output: '110 151 041' },
    { title: 'custom separator', input: 'AB', params: { separator: '\\n' }, output: '101\n102' }
  ],
  params: {
    separator: { kind: 'string', label: 'separator', default: ' ', placeholder: 'space, \\n, \\\\ ...' }
  },
  apply: (input: any, params: any = {}) => {
    const separator = unescapeSeparator(params?.separator, ' ')
    const bytes = toBytes(input)
    if (bytes.length === 0) return ''
    return Array.from(bytes)
      .map((b) => b.toString(8).padStart(3, '0'))
      .join(separator)
  }
}

export default util
