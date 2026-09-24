import { defineConfig } from 'vite'
import path from 'node:path'
import { builtinModules } from 'node:module'

// Every Node builtin, with and without the `node:` prefix — some deps import
// 'fs', others 'node:fs'.
const builtins = new Set([...builtinModules, ...builtinModules.map(m => `node:${m}`)])

/**
 * Single-file CommonJS bundle of the extension for the VS Code extension host
 * (a plain Node process): everything is bundled — the static registry, the core
 * engine, and every dependency a utility's `apply` dynamically imports — except
 * `vscode` itself, which only exists inside the host.
 */
export default defineConfig({
  resolve: {
    // Utility modules import the shared types/core via the `@/` alias, same as the app.
    alias: {
      '@': path.resolve(__dirname, '../../src'),
    },
  },
  // Vite's `root` defaults to the CWD (the repo root, since `build:vscode` is invoked from
  // there), so its default `publicDir` would otherwise be the *app's* `<repo>/public` —
  // and Vite copies that into every build's outDir unconditionally. This bundle is a
  // Node CLI-style file with no use for the web app's static assets, so that copy is
  // disabled outright rather than merely filtered out of the packaged .vsix.
  publicDir: false,
  build: {
    // Vite's CLI root defaults to the CWD it was invoked from (the repo root, per the
    // root `build:vscode` script), not this config file's directory — an outDir of just
    // 'dist' would land in (and empty!) the app's own `dist/`. Absolute avoids that.
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'node18',
    minify: false,
    sourcemap: true,
    lib: {
      entry: path.resolve(__dirname, 'src/extension.ts'),
      formats: ['cjs'],
      fileName: () => 'extension.cjs',
    },
    rollupOptions: {
      external: (id: string) => id === 'vscode' || builtins.has(id),
      output: {
        // One file: no chunk-loading infra needed, and it's simplest for VS Code to require.
        inlineDynamicImports: true,
        exports: 'named',
      },
    },
  },
})
