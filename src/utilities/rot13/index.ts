import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'rot13',
  name: 'ROT13',
  category: 'Encoding',
  description: 'Apply ROT13 cipher (shift letters by 13).',
  accepts: 'string',
  produces: 'string',
  tags: ['caesar cipher', 'rot-13', 'cipher', 'usenet', 'letter shift', 'obfuscate'],
  aliases: ['rot13'],
  streamable: true,
  examples: [{ title: 'basic', input: 'Hello, World!', output: 'Uryyb, Jbeyq!' }],
  params: {},
  apply: (input: any) => String(input).replace(/[a-zA-Z]/g, ch => {
    const base = ch <= 'Z' ? 65 : 97
    return String.fromCharCode(((ch.charCodeAt(0) - base + 13) % 26) + base)
  })
}
export default util
