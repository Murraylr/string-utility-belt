import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'format_case',
  name: 'format case',
  category: 'Formatting',
  description: 'Convert to camelCase, PascalCase, snake_case, or kebab-case.',
  accepts: 'string',
  produces: 'string',
  tags: ['camelcase', 'pascalcase', 'snake_case', 'kebab-case', 'identifier', 'variable name'],
  aliases: ['camelCase', 'snake_case', 'kebab-case'],
  examples: [
    { title: 'camelCase', input: 'hello world example', params: { mode: 'camel' }, output: 'helloWorldExample' },
    { title: 'snake_case', input: 'Hello World Example', params: { mode: 'snake' }, output: 'hello_world_example' }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['camel', 'pascal', 'snake', 'kebab', 'upper', 'lower', 'title', 'sentence'],
      default: 'camel'
    }
  },
  apply: (input: any, { mode: _mode }: any) => {
    const s = String(input)
    const mode = _mode || 'camel'
    switch (mode) {
      case 'camel':
        return toCamel(s)
      case 'pascal':
        return toPascal(s)
      case 'snake':
        return toSnake(s)
      case 'kebab':
        return toKebab(s)
      case 'upper':
        return s.toUpperCase()
      case 'lower':
        return s.toLowerCase()
      case 'title':
        return toTitleCase(s)
      case 'sentence':
        return toSentenceCase(s)
      default:
        return s
    }
  }
}

const splitWords = (s: string) => (s ?? '').toString().trim()
  .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
  .replace(/[^\p{L}\p{N}]+/gu, ' ')
  .toLowerCase()
  .split(' ')
  .filter(Boolean);
export const toCamel = (s: string) => {
  const words = splitWords(s);
  return words.map((w,i)=> i? (w[0].toUpperCase()+w.slice(1)) : w).join('');
};
export const toPascal = (s: string) => splitWords(s).map(w=>w[0].toUpperCase()+w.slice(1)).join('');
export const toSnake = (s: string) => splitWords(s).join('_');
export const toKebab = (s: string) => splitWords(s).join('-');

function toTitleCase(s: string): string {
  // Basic title-casing: capitalize first letter of words, leave other letters as-is.
  // Keeps small words capitalization naive — this is intentionally simple and deterministic.
  return s.replace(/\w\S*/g, (word) => {
    return word[0].toUpperCase() + word.slice(1).toLowerCase()
  })
}

function toSentenceCase(s: string): string {
  const trimmed = s.trim()
  if (!trimmed) return s
  return trimmed[0].toUpperCase() + trimmed.slice(1)
}

export default util
