// a larger lazy chunk, loaded on demand (e.g. a rarely-used utility or codemirror language mode)
export const payload = "0123456789".repeat(200);
export function noop() { return payload.length; }
