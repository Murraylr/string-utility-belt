import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { build, defineConfig, type InlineConfig, type Plugin } from 'vite'
import { BRIDGE_ORIGINS } from '../../src/core/extensionBridge'
import { MANIFEST } from '../../src/utilities/_generated/manifest'
import { UNSAFE_ENV } from './src/lib/constants'

// Utility modules import via the app's `@/` alias, so it must resolve here too.
const alias = { '@': resolve(__dirname, '../../src') }

/**
 * Drops the utilities the extension refuses to run (dom/main/eval, e.g.
 * custom_js and its sandbox) from the generated loader map, so their code is
 * never shipped at all — `isEdgeSafe` in `src/lib/registry.ts` still gates at
 * runtime; this just keeps the bundles smaller and eval-free.
 */
function edgeSafeLoaders(): Plugin {
  const unsafe = new Set(MANIFEST.filter(m => m.env.some(e => UNSAFE_ENV.has(e))).map(m => m.id))
  return {
    name: 'subelt-edge-safe-loaders',
    transform(code, id) {
      if (!/[\\/]_generated[\\/]loaders\.ts$/.test(id)) return null
      const kept = code.split('\n').filter(line => {
        const entry = /^\s*"([^"]+)":\s*\(\)\s*=>\s*import\(/.exec(line)
        return !entry || !unsafe.has(entry[1])
      })
      return { code: kept.join('\n'), map: null }
    },
  }
}

/**
 * The background service worker, built on its own as ONE self-contained ES
 * module. MV3 service workers throw on dynamic `import()` ("import() is
 * disallowed on ServiceWorkerGlobalScope"), and Vite's preload helper touches
 * `document`, so the lazily loaded utility chunks the popup/options pages use
 * cannot work here: `inlineDynamicImports` folds every one of them into
 * `background.js` instead.
 */
function backgroundBuild(outDir: string, mode: string): InlineConfig {
  return {
    configFile: false,
    root: __dirname,
    base: '',
    mode,
    logLevel: 'warn',
    publicDir: false,
    resolve: { alias },
    plugins: [edgeSafeLoaders()],
    build: {
      outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      target: 'es2022',
      modulePreload: false,
      reportCompressedSize: false,
      chunkSizeWarningLimit: 8192,
      rollupOptions: {
        input: resolve(__dirname, 'src/background.ts'),
        output: { format: 'es', entryFileNames: 'background.js', inlineDynamicImports: true },
      },
    },
  }
}

/**
 * The page-bridge content script: one classic script (an IIFE), because
 * Chrome loads content scripts as plain scripts, never as ES modules.
 */
function bridgeBuild(outDir: string, mode: string): InlineConfig {
  return {
    configFile: false,
    root: __dirname,
    base: '',
    mode,
    logLevel: 'warn',
    publicDir: false,
    resolve: { alias },
    build: {
      outDir,
      emptyOutDir: false,
      copyPublicDir: false,
      target: 'es2022',
      modulePreload: false,
      reportCompressedSize: false,
      rollupOptions: {
        input: resolve(__dirname, 'src/bridge.ts'),
        output: { format: 'iife', entryFileNames: 'bridge.js', inlineDynamicImports: true },
      },
    },
  }
}

/** A development build also bridges to a local dev server (any port); production never does. */
const DEV_BRIDGE_MATCHES = ['http://localhost/*', 'http://127.0.0.1/*']

/**
 * The content script's `matches` must be exactly the origins the app and the
 * service worker trust (`BRIDGE_ORIGINS`): fail the build rather than ship a
 * bridge that runs somewhere the worker refuses, or not where the app expects.
 */
function bridgeMatches(manifest: { content_scripts?: Array<{ js?: string[]; matches?: string[] }> }, mode: string): void {
  const entry = manifest.content_scripts?.find(c => c.js?.includes('bridge.js'))
  if (!entry?.matches) throw new Error('manifest.json: no content script entry for bridge.js')
  const expected = BRIDGE_ORIGINS.map(o => `${o}/*`)
  if (entry.matches.join('\n') !== expected.join('\n')) {
    throw new Error(`manifest.json: bridge.js matches ${JSON.stringify(entry.matches)}, expected ${JSON.stringify(expected)} (BRIDGE_ORIGINS)`)
  }
  if (mode !== 'production') entry.matches = [...expected, ...DEV_BRIDGE_MATCHES]
}

/**
 * After the popup/options pages are written: builds the service worker and
 * the page-bridge content script into the same output directory, then copies
 * `manifest.json` (its `version` stamped from the repo root's `package.json`,
 * so it never drifts) and `icons/`. Uses the output dir Rollup actually wrote
 * to, so `--outDir` works.
 */
function extensionAssets(): Plugin {
  let mode = 'production'
  return {
    name: 'subelt-extension-assets',
    apply: 'build',
    configResolved(config) { mode = config.mode },
    async writeBundle(options) {
      const outDir = options.dir ?? resolve(__dirname, 'dist')
      await build(backgroundBuild(outDir, mode))
      await build(bridgeBuild(outDir, mode))
      mkdirSync(outDir, { recursive: true })
      const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf8'))
      const manifest = JSON.parse(readFileSync(resolve(__dirname, 'manifest.json'), 'utf8'))
      manifest.version = rootPkg.version
      bridgeMatches(manifest, mode)
      writeFileSync(resolve(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
      cpSync(resolve(__dirname, 'icons'), resolve(outDir, 'icons'), { recursive: true })
    },
  }
}

// Popup and options are HTML entries (Vite rewrites their <script type="module">
// tags to the hashed bundles; no inline scripts, per the MV3 CSP). Extension
// pages are documents, so they keep per-utility code splitting.
export default defineConfig({
  root: __dirname,
  base: '',
  publicDir: false,
  resolve: { alias },
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2022',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'popup.html'),
        options: resolve(__dirname, 'options.html'),
      },
      output: {
        format: 'es',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [edgeSafeLoaders(), extensionAssets()],
})
