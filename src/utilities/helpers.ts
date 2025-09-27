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

// MD5: prefer Node crypto when available (tests), else use pure JS fallback.
declare const __md5Node: undefined | ((s: string) => string);
export function md5(str = ''): string {
  if (typeof __md5Node === 'function') return __md5Node(str);
  return md5js(str);
}

/** Pure-JS MD5 fallback (tested against standard vectors) */
function md5js(str: string): string {
  function toUtf8(s: string) { return unescape(encodeURIComponent(s)); }
  function add32(a: number, b: number) { return (a + b) & 0xffffffff; }
  function cmn(q: number, a: number, b: number, x: number, s: number, t: number) {
    a = add32(add32(a, q), add32(x, t)); return add32((a << s) | (a >>> (32 - s)), b);
  }
  function ff(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & c) | (~b & d), a, b, x, s, t); }
  function gg(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn((b & d) | (c & ~d), a, b, x, s, t); }
  function hh(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(b ^ c ^ d, a, b, x, s, t); }
  function ii(a: number, b: number, c: number, d: number, x: number, s: number, t: number) { return cmn(c ^ (b | ~d), a, b, x, s, t); }
  function md5blk(s: string) {
    const blocks = new Array(16);
    for (let i=0;i<16;i++) blocks[i] = s.charCodeAt(i*4) + (s.charCodeAt(i*4+1) << 8) + (s.charCodeAt(i*4+2) << 16) + (s.charCodeAt(i*4+3) << 24);
    return blocks;
  }
  function rhex(n: number) {
    const s = '0123456789abcdef'; let out = '';
    for (let j=0; j<4; j++) { const b = (n >>> (j*8)) & 255; out += s[(b>>>4)&15] + s[b&15]; }
    return out;
  }
  function md51(s: string) {
    let n = s.length, i = 0;
    let a = 1732584193, b = -271733879, c = -1732584194, d = 271733878;
    for (; i + 64 <= n; i += 64) {
      const x = md5blk(s.substring(i, i+64));
      a = ff(a,b,c,d, x[0],  7, -680876936); d = ff(d,a,b,c, x[1], 12, -389564586); c = ff(c,d,a,b, x[2], 17,  606105819); b = ff(b,c,d,a, x[3], 22,-1044525330);
      a = ff(a,b,c,d, x[4],  7,-176418897); d = ff(d,a,b,c, x[5], 12, 1200080426); c = ff(c,d,a,b, x[6], 17,-1473231341); b = ff(b,c,d,a, x[7], 22,  -45705983);
      a = ff(a,b,c,d, x[8],  7, 1770035416); d = ff(d,a,b,c, x[9], 12,-1958414417); c = ff(c,d,a,b,x[10], 17,       -42063); b = ff(b,c,d,a,x[11], 22,-1990404162);
      a = ff(a,b,c,d,x[12],  7, 1804603682); d = ff(d,a,b,c,x[13], 12,   -40341101); c = ff(c,d,a,b,x[14], 17,-1502002290); b = ff(b,c,d,a,x[15], 22, 1236535329);
      a = add32(a, 1732584193); b = add32(b, -271733879); c = add32(c, -1732584194); d = add32(d, 271733878);
    }
    const tail = new Array(16).fill(0);
    let r = n - i;
    for (let j=0; j<r; j++) tail[j>>2] |= s.charCodeAt(i+j) << ((j%4) << 3);
    tail[r>>2] |= 0x80 << ((r%4) << 3);
    if (r > 55) {
      calc(tail);
      for (let k=0;k<16;k++) tail[k]=0;
    }
    tail[14] = n * 8;
    calc(tail);
    return [a,b,c,d];

    function calc(x: number[]) {
      let a0=a,b0=b,c0=c,d0=d;
      a0 = ff(a0,b0,c0,d0, x[0],  7, -680876936); d0 = ff(d0,a0,b0,c0, x[1], 12, -389564586); c0 = ff(c0,d0,a0,b0, x[2], 17,  606105819); b0 = ff(b0,c0,d0,a0, x[3], 22,-1044525330);
      a0 = ff(a0,b0,c0,d0, x[4],  7,-176418897); d0 = ff(d0,a0,b0,c0, x[5], 12, 1200080426); c0 = ff(c0,d0,a0,b0, x[6], 17,-1473231341); b0 = ff(b0,c0,d0,a0, x[7], 22,  -45705983);
      a0 = ff(a0,b0,c0,d0, x[8],  7, 1770035416); d0 = ff(d0,a0,b0,c0, x[9], 12,-1958414417); c0 = ff(c0,d0,a0,b0,x[10], 17,       -42063); b0 = ff(b0,c0,d0,a0,x[11], 22,-1990404162);
      a0 = ff(a0,b0,c0,d0,x[12],  7, 1804603682); d0 = ff(d0,a0,b0,c0,x[13], 12,   -40341101); c0 = ff(c0,d0,a0,b0,x[14], 17,-1502002290); b0 = ff(b0,c0,d0,a0,x[15], 22, 1236535329);
      a = add32(a, a0); b = add32(b, b0); c = add32(c, c0); d = add32(d, d0);
    }
  }
  const x = md51(toUtf8(str));
  return rhex(x[0]) + rhex(x[1]) + rhex(x[2]) + rhex(x[3]);
}
