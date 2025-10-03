import type { Utility, Value, ValueType, Accepts } from '@/types/utility';
import { textToUint8Array } from '@/utilities/helpers';

const modulesTs  = import.meta.glob('./**/index.ts',  { eager: true }) as Record<string, { default?: Utility }>;
const modulesTsx = import.meta.glob('./**/index.tsx', { eager: true }) as Record<string, { default?: Utility }>;
const allModules = { ...modulesTs, ...modulesTsx };

function pickUtilities(records: Record<string, { default?: Utility }>): Utility[] {
  const arr: Utility[] = [];
  for (const [key, mod] of Object.entries(records)) {
    const util = (mod && 'default' in mod) ? (mod.default as Utility | undefined) : undefined;
    if (!util) { console.warn('[utilities] skipped module without default export:', key); continue; }
    arr.push(util);
  }
  return arr;
}

export const UTILITIES: Utility[] = pickUtilities(allModules);

export const UTIL_MAP: Record<string, Utility> = Object.fromEntries(UTILITIES.map(u => [u.id, u]));

export const CATEGORIES: string[] = Array.from(new Set(['All', ...UTILITIES.map(u => u.category || 'Other')]));

export function getUtilities(): Utility[] { return UTILITIES; }
export function getCategories(): string[] { return CATEGORIES; }
export function getUtilitiesByCategory(category?: string): Utility[] {
  if (!category || category === 'All') return UTILITIES;
  return UTILITIES.filter(u => (u.category || 'Other') === category);
}

export const UTIL_DISPLAY = UTILITIES.map(u => ({
  id: u.id, name: u.name, description: u.description || '',
  category: u.category || 'Other', params: u.params || {},
  accepts: u.accepts ?? 'string', produces: u.produces ?? 'string',
}));

type Step = { id: string; utilityId: string; enabled?: boolean; params?: Record<string, unknown> };
function isEnabled(step: Step) { return step.enabled !== false; }


function coerceInputFor(value: ValueType, want: Accepts): Value {
  


  if (want.includes(value)) return value;

  //switch value type of value
  switch (typeof value) {
    case 'undefined': return value;
    case 'string':    return value;
    case 'object':
      if (value === null) return value;
      if (value instanceof Uint8Array) return value;
      return value; // assume JSON
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
    case 'function':
      return String(value);
    default:       return value;
  }




  // string -> bytes
  if (want.includes('bytes') && have === 'string') {
    return textToUint8Array(value as string);
  }

  // bytes -> string
  if (want.includes('string') && have === 'bytes') {
    return new TextDecoder().decode(value as Uint8Array);
  }

  // string -> json
  if (want.includes('json') && have === 'string') {
    try { return JSON.parse(value as string); } catch { return value; }
  }

  // bytes -> json (assume UTF-8 text JSON)
  if (want.includes('json') && have === 'bytes') {
    try {
      const s = new TextDecoder().decode(value as Uint8Array);
      return JSON.parse(s);
    } catch {
      return value;
    }
  }

  // json -> string
  if (want.includes('string') && have === 'json') {
    try { return JSON.stringify(value); } catch { return String(value); }
  }

  // Fallback: don’t coerce
  return value;
}
export function formatForDisplay(v: Value): string {
  const t = valueType(v);
  if (t === 'bytes') {
    const arr = Array.from(v as Uint8Array);
    const byteArray = arr.map(b => b.toString().padStart(2,'0')).join(', ');
    const hexArray = arr.map(b => b.toString(16).padStart(2,'0')).join(', ');
    let utf8 = ''; try { utf8 = new TextDecoder().decode(v as Uint8Array); } catch {}
    return `bytes[${byteArray}]\nhex: [${hexArray}]${utf8 ? `\nutf8: ${utf8}` : ''}`;
  }
  if (t === 'json') { try { return JSON.stringify(v, null, 2); } catch { return String(v); } }
  return String(v ?? '');
}
export async function runPipeline(source: Value, steps: Step[], wantPreviews = false) {
  let out: Value = source;
  const previews: Record<string, Value> = {};
  const err: Record<string, string> = {};
  for (const step of steps) {
    if (!isEnabled(step)) { if (wantPreviews) previews[step.id] = out; continue; }
    const util = UTIL_MAP[step.utilityId];
    if (!util) { err[step.id] = 'unknown utility'; continue; }
    try {
      const coerced = coerceInputFor(out, util.accepts);
      const result = await util.apply(coerced, step.params ?? {});
      out = result;
      if (wantPreviews) previews[step.id] = out;
    } catch (e: any) { err[step.id] = e?.message || String(e); }
  }
  return { out, previews, err };
}
export default UTILITIES;
