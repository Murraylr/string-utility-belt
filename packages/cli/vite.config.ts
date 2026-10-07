import { builtinModules } from 'node:module'
import path from 'node:path'
import { defineConfig } from 'vite'

const builtins = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)])

/**
 * SSR build of src/bin.ts into packages/cli/dist/subelt.mjs (what the root
 * package.json's `bin.subelt` points at) plus lazily-loaded chunks in
 * dist/chunks/. Every utility and every dependency is bundled, so `dist/` runs
 * standalone with only Node's own built-ins left external; the dependencies
 * utilities `import()` on demand stay in their own chunks, so a run only
 * parses what its steps actually use.
 *
 * Run with `npm run build:cli`.
 */
export default defineConfig({
  // Vite's `root` (and therefore relative `build.outDir`) defaults to `process.cwd()`,
  // not the config file's own directory — since `build:cli` is run from the repo
  // root, both must be pinned here or the build lands in the repo root's `dist/`.
  root: __dirname,
  resolve: {
    alias: { '@': path.resolve(__dirname, '../../src') },
  },
  // An SSR build externalizes every node_modules dependency by default, which would
  // leave `import "lz-string"` / `import("yaml")` etc. in the output — fine inside this
  // repo, broken for `npx subelt` (the published package has no dependencies).
  ssr: { noExternal: true, target: 'node' },
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'node20',
    minify: false,
    sourcemap: false,
    ssr: path.resolve(__dirname, 'src/bin.ts'),
    // Some dependencies' Node builds are ES modules that still call `require()`
    // (turndown → domino); without this those calls survive and throw in ESM.
    commonjsOptions: { transformMixedEsModules: true },
    rollupOptions: {
      external: id => builtins.has(id),
      output: {
        format: 'es',
        entryFileNames: 'subelt.mjs',
        chunkFileNames: 'chunks/[name]-[hash].mjs',
        banner: chunk => (chunk.isEntry ? '#!/usr/bin/env node' : ''),
        // unminified output keeps dependencies' JSDoc, e.g. franc-min's `@typedef {import('trigram-utils')…}`:
        // dead weight in the package that reads like an unbundled import (licence comments are kept)
        comments: { jsdoc: false },
      },
    },
  },
})
