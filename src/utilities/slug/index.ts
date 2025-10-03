import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'slug',
  name: 'slug',
  category: 'Formatting',
  description: 'Convert to a URL-friendly slug (ASCII kebab-case).',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (s: string) => (s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}
export default util
