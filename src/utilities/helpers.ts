
// UID
export const uid = (() => { let n = 0; return (p='id') => `${p}_${Date.now()}_${n++}` })();

// Bytes & encodings
export const textToUint8Array = (txt: string) => new TextEncoder().encode(txt);
export const bytesToHex = (arr: Uint8Array) => Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
export const hexToBytes = (hex: string) => {
  const clean = (hex || '').replace(/\s+/g, '');
  if (clean.length % 2) throw new Error('invalid hex length');
  if (!/^[0-9a-fA-F]*$/.test(clean)) throw new Error('invalid hex');
  const out = new Uint8Array(clean.length/2);
  for (let i=0;i<out.length;i++) out[i] = parseInt(clean.substr(i*2,2),16);
  return out;
};
// the internal [[TypedArrayName]] slot, not constructor.name: a JSON object shaped like
// {"constructor":{"name":"Uint8Array"}} must not pass for bytes (cross-realm arrays still do)
export const isBytes = (v: any): v is Uint8Array =>
  v instanceof Uint8Array ||
  (ArrayBuffer.isView(v) && Object.prototype.toString.call(v) === '[object Uint8Array]');

export const b64encode = (s: string) => {
  const bytes = textToUint8Array(s);
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
export const b64decode = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array([...bin].map(c => c.charCodeAt(0)));
  // fatal: surface non-UTF-8 payloads as a step error instead of silently
  // replacing bytes with U+FFFD and destroying data
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};

// Case helpers

export const normalizeCase = (s: string, mode: 'upper'|'lower'|'title'|'sentence'='lower') => {
  if (mode === 'upper') return s.toUpperCase();
  if (mode === 'lower') return s.toLowerCase();
  if (mode === 'sentence') return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
};

export async function hashString(input: string | Uint8Array, algorithm: AlgorithmIdentifier = 'SHA-256') {
  const bytes = typeof input === 'string' ? textToUint8Array(input) : input;
  const digest = await crypto.subtle.digest(algorithm, bytes as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

