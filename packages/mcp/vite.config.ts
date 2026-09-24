import { builtinModules, createRequire } from 'node:module'
import path from 'node:path'
import { defineConfig } from 'vite'

const builtins = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)])
const requireHere = createRequire(path.resolve(__dirname, 'package.json'))

/**
 * SSR build of src/bin.ts into one standalone file, packages/mcp/dist/server.mjs.
 * Only Node's own builtins stay external — the MCP SDK, zod and every dependency a
 * utility dynamically imports are inlined, so `node dist/server.mjs` needs no
 * node_modules next to it.
 *
 * It must be an SSR build: a plain `build.lib` resolves packages with *browser*
 * conditions/`browser` fields, which bundles browser-only variants (turndown's needs
 * `document`) that pass every in-process test and then fail in the binary.
 */
export default defineConfig({
  // Vite's `root` (and therefore relative `outDir`/`publicDir`) defaults to the
  // process's cwd, not this config file's directory — `npm run build:mcp` runs
  // from the repo root, so without this, 'dist' would resolve to the *repo root's*
  // dist/ (the web app's own build output) instead of packages/mcp/dist.
  root: __dirname,
  publicDir: false,
  resolve: {
    alias: [
      // Utility modules use the app's `@/` -> `src/` alias (see tsconfig.json paths).
      { find: '@', replacement: path.resolve(__dirname, '../../src') },
      // turndown's Node ESM build calls a bare `require('@mixmark-io/domino')`, which
      // Rollup leaves as-is (a ReferenceError at startup); its CJS build converts cleanly.
      { find: /^turndown$/, replacement: requireHere.resolve('turndown') },
    ],
  },
  ssr: { noExternal: true, target: 'node' },
  build: {
    target: 'node20',
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    minify: false,
    ssr: path.resolve(__dirname, 'src/bin.ts'),
    rollupOptions: {
      external: id => builtins.has(id),
      output: {
        format: 'es',
        entryFileNames: 'server.mjs',
        // A single runnable file (it is also the job-runner entry): every dynamic
        // `import('yaml')`-style utility dependency is inlined, not split into a chunk.
        inlineDynamicImports: true,
        banner: '#!/usr/bin/env node',
      },
    },
  },
})
