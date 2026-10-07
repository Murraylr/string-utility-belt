import { run } from '../../harness'
const u = (id: string, params: any = {}) => ({ id, utilityId: id, enabled: true, params }) as any
console.log('MISC html_entity_decode', JSON.stringify((await run('https://a.example.com/?x=1&reg=3&not=4&amp;utm_source=y', [u('html_entity_decode')])).out), JSON.stringify((await run('x', [u('html_entity_decode')])).errors))
console.log('MISC slug alone on list', JSON.stringify((await run('One Title\nTwo Title', [u('slug')])).out))
console.log('MISC validate slug perLine', JSON.stringify((await run('Oﬃce Workﬂow\nStraße', [u('validate', { type: 'slug', perLine: true })])).out).slice(0, 300))
