import { existsSync, readdirSync, rmSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const builtins = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)])
const outDir = path.resolve(__dirname, 'dist')

/**
 * Empties dist/ like `emptyOutDir` would, except dist/types — the declarations
 * `tsc -p packages/core/tsconfig.json` emits — so the JS and type builds can run
 * in either order.
 */
function cleanDistKeepingTypes(): Plugin {
  return {
    name: 'subelt-core:clean-dist-keep-types',
    apply: 'build',
    buildStart() {
      if (!existsSync(outDir)) return
      for (const entry of readdirSync(outDir)) {
        if (entry !== 'types') rmSync(path.join(outDir, entry), { recursive: true, force: true })
      }
    },
  }
}

/**
 * Library build of the framework-free core + all utilities for Node hosts
 * (CLI, servers, scripts). Everything is bundled in — utilities and their
 * dynamically-imported dependencies alike — so `dist/` is a self-contained
 * package; only Node's own built-ins are left external.
 *
 * Run with `npm run build:core`. Type declarations are a separate step:
 * `npx tsc -p packages/core/tsconfig.json`.
 */
export default defineConfig({
  // Vite's `root` (and therefore relative `build.outDir`) defaults to `process.cwd()`,
  // not the config file's own directory — since `build:core` is run from the repo
  // root, both must be pinned here or the build lands in the repo root's `dist/`.
  root: __dirname,
  resolve: {
    alias: { '@': path.resolve(__dirname, '../../src') },
  },
  plugins: [cleanDistKeepingTypes()],
  build: {
    outDir,
    emptyOutDir: false,
    target: 'node20',
    minify: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'index.mjs',
    },
    rollupOptions: {
      external: id => builtins.has(id),
    },
  },
})
