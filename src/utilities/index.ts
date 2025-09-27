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

// Backward-compat ids
const ALIASES: Record<string, string> = {
  uppercase: 'upper',
  upper: 'uppercase',
};
for (const [alias, target] of Object.entries(ALIASES)) {
  if (UTIL_MAP[target]) UTIL_MAP[alias] = UTIL_MAP[target];
}

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

export type { Utility, Value, ValueType } from '@/types/utility';

export function valueType(v: Value): ValueType {
  if (v instanceof Uint8Array) return 'bytes';
  if (v && typeof v === 'object' && !Array.isArray(v)) return 'json';
  return 'string';
}
type Step = { id: string; utilityId: string; enabled?: boolean; params?: Record<string, unknown> };
function isEnabled(step: Step) { return step.enabled !== false; }

import type { Accepts as _A } from '@/types/utility';
type Accepts = _A;
function acceptsType(accepts: Accepts | undefined, t: ValueType) {
  if (!accepts) return t === 'string';
  return Array.isArray(accepts) ? accepts.includes(t) : accepts === t;
}
function coerceInputFor(util: Utility, value: Value): Value {
  const have = valueType(value);
  const accepts = util.accepts ?? 'string';
  if (acceptsType(accepts, have)) return value;
  const targets: ValueType[] = Array.isArray(accepts) ? accepts : [accepts];
  for (const want of targets) {
    if (want === 'string' && have === 'bytes') return new TextDecoder().decode(value as Uint8Array);
    if (want === 'string' && have === 'json') { try { return JSON.stringify(value); } catch { return String(value); } }
    if (want === 'bytes' && have === 'string') return textToUint8Array(value as string);
    if (want === 'json' && have === 'string') { try { return JSON.parse(value as string); } catch {} }
    if (want === 'bytes' && have === 'json') { try { return textToUint8Array(JSON.stringify(value)); } catch {} }
    if (want === 'json' && have === 'bytes') { try { return JSON.parse(new TextDecoder().decode(value as Uint8Array)); } catch {} }
  }
  return value;
}
export function formatForDisplay(v: Value): string {
  const t = valueType(v);
  if (t === 'bytes') {
    const arr = Array.from(v as Uint8Array).map(b => b.toString(16).padStart(2,'0')).join(' ');
    let utf8 = ''; try { utf8 = new TextDecoder().decode(v as Uint8Array); } catch {}
    return `bytes[${(v as Uint8Array).length}]\nhex: ${arr}${utf8 ? `\nutf8: ${utf8}` : ''}`;
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
      const coerced = coerceInputFor(util, out);
      const result = await util.apply(coerced, step.params ?? {});
      out = result;
      if (wantPreviews) previews[step.id] = out;
    } catch (e: any) { err[step.id] = e?.message || String(e); }
  }
  return { out, previews, err };
}
export default UTILITIES;
