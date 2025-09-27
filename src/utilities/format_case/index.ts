import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'format_case',
  name: 'format case',
  category: 'Formatting',
  description: 'Convert to camelCase, PascalCase, snake_case, or kebab-case.',
  accepts: 'string',
  produces: 'string',
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['camel', 'pascal', 'snake', 'kebab', 'upper', 'lower', 'title', 'sentence'],
      default: 'camel'
    }
  },
  apply: (input: any, { mode }: any) => {
    const s = String(input)
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
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[^A-Za-z0-9]+/g, ' ')
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
  if (!s) return s
  const trimmed = s.trim()
  return trimmed[0].toUpperCase() + trimmed.slice(1)
}

export default util
