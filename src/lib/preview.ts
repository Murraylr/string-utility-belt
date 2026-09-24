import { Value } from '@/types/values';

/**
 * Pure preview formatter.
 * - NEVER mutates or returns a value that should be re‑used as pipeline input.
 * - Call sites must treat the return value as DISPLAY‑ONLY.
 */
export type PreviewHint = 'auto' | 'bytes' | 'json' | 'string';

function isBytes(v: Value): v is Uint8Array {
  return typeof v !== 'string';
}

export function formatForDisplay(v: Value, hint: PreviewHint = 'auto'): string {
  const t: PreviewHint =
    hint === 'auto' ? (isBytes(v) ? 'bytes' : 'string') : hint;

  if (t === 'bytes') {
    if (!isBytes(v)) return '(not bytes)';
    // Precompute small string representations; do not expose/return the raw array.
    const hex = Array.from(v).map(b => b.toString(16).padStart(2, '0')).join(' ');
    let utf8 = '';
    try { utf8 = new TextDecoder().decode(v); } catch { /* non-UTF-8 bytes: omit utf8 line */ }
    return `bytes[${v.length}]\nhex: ${hex}${utf8 ? `\nutf8: ${utf8}` : ''}`;
  }

  if (t === 'json') {
    try { return JSON.stringify(v, null, 2); } catch { return String(v ?? ''); }
  }

  // string
  return typeof v === 'string' ? v : `[bytes ${v.length}]`;
}

/**
 * Back‑compat alias some files import.
 */
export const serializePreview = formatForDisplay;
