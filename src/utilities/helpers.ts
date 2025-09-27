
// UID
export const uid = (() => { let n = 0; return (p='id') => `${p}_${Date.now()}_${n++}` })();

// Bytes & encodings
export const textToUint8Array = (txt: string) => new TextEncoder().encode(txt);
export const bytesToHex = (arr: Uint8Array) => Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
export const hexToBytes = (hex: string) => {
  const clean = (hex || '').replace(/\s+/g, '');
  if (clean.length % 2) throw new Error('invalid hex length');
  const out = new Uint8Array(clean.length/2);
  for (let i=0;i<out.length;i++) out[i] = parseInt(clean.substr(i*2,2),16);
  return out;
};
export const isBytes = (v: any): v is Uint8Array => v instanceof Uint8Array || (v && v.constructor && v.constructor.name === 'Uint8Array');

export const b64encode = (s: string) => {
  const bytes = textToUint8Array(s);
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
};
export const b64decode = (b64: string) => {
  const bin = atob(b64);
  const bytes = new Uint8Array([...bin].map(c => c.charCodeAt(0)));
  return new TextDecoder().decode(bytes);
};

// Case helpers
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
export const normalizeCase = (s: string, mode: 'upper'|'lower'|'title'='lower') => {
  if (mode === 'upper') return s.toUpperCase();
  if (mode === 'lower') return s.toLowerCase();
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
};
export const slugify = (s: string) => (s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Za-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

export async function hashString(input: string, algorithm: AlgorithmIdentifier = 'SHA-256') {
  const bytes = textToUint8Array(input);
  const digest = await crypto.subtle.digest(algorithm, bytes);
  return bytesToHex(new Uint8Array(digest));
}

