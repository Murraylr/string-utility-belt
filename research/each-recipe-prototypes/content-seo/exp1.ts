import { run } from '../harness'
const s = (utilityId: string, params: any = {}, extra: any = {}) => ({ id: utilityId + Math.random().toString(36).slice(2, 6), utilityId, enabled: true, params, ...extra })
const inp = 'https://example.com/?a=1&amp;copy=2&reg=3&lang=en&not=4&amp;utm_source=x'
for (const u of ['unescape_html', 'html_entity_decode', 'xml_unescape']) {
  console.log(u, JSON.stringify((await run(inp, [s(u)])).out))
}
// query_params_normalize on whole multi-line text
const multi = 'https://example.com/a?utm_source=x&id=1\nhttps://example.com/b?fbclid=abc#top\nQ&A recap?\nWhich links still work?'
console.log('whole:', JSON.stringify((await run(multi, [s('query_params_normalize', { drop: 'utm_*,fbclid' })])).out))
const each = (steps: any[], split: any = { mode: 'lines' }) => ({ id: 'e' + Math.random().toString(36).slice(2, 6), type: 'each', enabled: true, split, skipEmpty: true, steps })
console.log('each nocond:', JSON.stringify((await run(multi, [each([s('query_params_normalize', { drop: 'utm_*,fbclid' })])])).out))
console.log('each nocond nosort:', JSON.stringify((await run(multi, [each([s('query_params_normalize', { drop: 'utm_*,fbclid', sort: false, dedupe: 'none', lowercaseHost: false })])])).out))
