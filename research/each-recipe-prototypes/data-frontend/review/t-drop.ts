import { run } from '../../harness'
const u = (id: string, utilityId: string, params: any = {}) => ({ id, utilityId, enabled: true, params }) as any
console.log('json5 numeric keys:', (await run("{ brand: { 50: '#eff6ff', 500: '#3b82f6' } }", [u('p', 'json5_parse', { indent: 2 })])).errors)
console.log('color_convert perLine on hex list:', JSON.stringify((await run('#eff6ff\n#3b82f6\n', [u('c', 'color_convert', { to: 'oklch', perLine: true, precision: 3 })])).out))
console.log('color_convert perLine on css vars:', JSON.stringify((await run('--brand-50: #eff6ff;\n--brand-500: #3b82f6;\n', [u('c', 'color_convert', { to: 'oklch', perLine: true, precision: 3 })])))?.slice?.(0, 300) ?? '')
const r = await run('--brand-50: #eff6ff;\n--brand-500: #3b82f6;\n', [u('c', 'color_convert', { to: 'oklch', perLine: true, precision: 3 })]); console.log(JSON.stringify(r.out), r.errors)
