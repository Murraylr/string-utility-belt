import { run } from '../harness'
const s = (utilityId: string, params: any = {}, extra: any = {}) => ({ id: utilityId + Math.random().toString(36).slice(2, 6), utilityId, enabled: true, params, ...extra })
const each = (steps: any[], split: any = { mode: 'lines' }) => ({ id: 'e' + Math.random().toString(36).slice(2, 6), type: 'each', enabled: true, split, skipEmpty: true, steps })
const titles = [
  'Don’t Miss: 10 SEO Tips for 2026',
  'Straße, Smørrebrød & Łódź: A Food Tour',
  'Ærø Island Guide — Œuvres & Ðakovo',
  'Why “Évian” Isn\'t Spelled Evian',
  'C++ vs C#: Which Should You Learn?',
  '50% Off Everything! 🎉',
  'Привет мир',
  '東京 Travel Guide',
  'İstanbul’da ılık bir gün',
  '  Leading and trailing spaces  ',
  'Þingvellir & the Golden Circle',
].join('\n')
console.log('slug whole:', JSON.stringify((await run(titles, [s('slug')])).out))
console.log('each slug:\n' + (await run(titles, [each([s('slug')])])).out)
console.log('format_case kebab each:\n' + (await run(titles, [each([s('format_case', { mode: 'kebab' })])])).out)
console.log('normalize NFKD:', JSON.stringify((await run('ﬁnal ½ ²', [s('normalize', { form: 'NFKD' })])).out))
