import '@testing-library/jest-dom/vitest'
// Provide a Node-backed MD5 for tests so vectors match exactly.
try {
  // node:crypto is available in Vitest (jsdom env still runs on Node)
  const { createHash } = await import('node:crypto');
  // @ts-ignore
  globalThis.__md5Node = (s: string) => createHash('md5').update(s, 'utf8').digest('hex');
} catch {}
