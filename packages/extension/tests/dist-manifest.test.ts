// @vitest-environment node
/**
 * Validates the built extension, not the source — only meaningful after
 * `npm run build:extension`. Skipped entirely when `dist/` hasn't been built
 * yet (e.g. a fresh checkout that only ran the unit tests). Runs in plain Node
 * (no DOM), which is close to what a service worker has.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { beforeAll, describe, expect, it } from 'vitest'
import { BRIDGE_ORIGINS } from '../../../src/core/extensionBridge'

const distDir = resolve(__dirname, '../dist')
const hasDist = existsSync(resolve(distDir, 'manifest.json'))

const describeIfBuilt = hasDist ? describe : describe.skip

// `describe.skip` still runs these callbacks while collecting, so nothing may
// touch dist/ outside an `it`/hook.
const read = (file: string) => readFileSync(resolve(distDir, file), 'utf8')
const readManifest = () => JSON.parse(read('manifest.json'))

describeIfBuilt('built extension (dist/)', () => {
  it('references only files that exist in dist/', () => {
    const manifest = readManifest()
    const referenced = new Set<string>([
      manifest.background?.service_worker,
      manifest.action?.default_popup,
      manifest.options_page,
      ...Object.values<string>(manifest.icons ?? {}),
      ...Object.values<string>(manifest.action?.default_icon ?? {}),
    ].filter(Boolean))

    expect(referenced.size).toBe(7) // worker, popup, options, and 4 icon sizes shared by both icon maps
    for (const file of referenced) {
      expect(existsSync(resolve(distDir, file)), `manifest.json references missing file: ${file}`).toBe(true)
    }
  })

  it('matches the required manifest shape, with the root package version', () => {
    const manifest = readManifest()
    const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../../package.json'), 'utf8'))
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.name).toBe('String Utility Belt')
    expect(manifest.version).toBe(rootPkg.version)
    expect([...manifest.permissions].sort()).toEqual(['activeTab', 'clipboardWrite', 'contextMenus', 'scripting', 'storage'])
    expect(manifest.host_permissions).toBeUndefined()
    expect(manifest.content_scripts).toBeUndefined() // a host permission: a new install warning, which disables existing installs on update
    expect(manifest.background).toEqual({ service_worker: 'background.js', type: 'module' })
    expect(manifest.content_security_policy.extension_pages).toBe("script-src 'self' 'wasm-unsafe-eval'; object-src 'self'")
  })

  it('lets only the app\'s own origins message it (a production build has no localhost)', () => {
    expect(readManifest().externally_connectable).toEqual({ matches: BRIDGE_ORIGINS.map(o => `${o}/*`) })
  })

  it.each(['popup.html', 'options.html'])('%s loads only existing files and has no inline script (MV3 CSP)', page => {
    const doc = new JSDOM(read(page)).window.document
    const scripts = [...doc.querySelectorAll('script')]
    expect(scripts.length).toBeGreaterThan(0)
    for (const script of scripts) {
      expect(script.getAttribute('src'), 'inline <script> is blocked by the extension CSP').toBeTruthy()
      expect(script.textContent?.trim()).toBe('')
    }
    const refs = [...doc.querySelectorAll('script[src], link[href]')].map(el => el.getAttribute('src') ?? el.getAttribute('href')!)
    for (const ref of refs) {
      expect(existsSync(resolve(distDir, dirname(page), ref)), `${page} references missing ${ref}`).toBe(true)
    }
    expect(doc.querySelector('[onclick], [onload], [onerror], a[href^="javascript:"]')).toBeNull()
  })

  it('the service worker is one self-contained module: no import() (a TypeError in MV3 service workers), no chunk imports', () => {
    const code = read('background.js')
    expect(code).not.toMatch(/\bimport\s*\(/)
    expect(code).not.toMatch(/\bfrom\s*["']\.{1,2}\/|\bimport\s*["']\.{1,2}\//)
    expect(code).not.toContain('__subeltSandbox') // custom_js (eval) is never shipped
  })

  describe('service worker, evaluated without a DOM', () => {
    type Listener = (...args: unknown[]) => unknown
    type Injected = { func: (...args: unknown[]) => unknown; args?: unknown[]; target: { tabId: number; frameIds?: number[] } }
    const listeners: Record<string, Listener[]> = { installed: [], startup: [], changed: [], clicked: [], external: [] }
    const menus: Array<{ id: string; title?: string }> = []
    const local: Record<string, unknown> = {}
    const opened: string[] = []
    let dom: JSDOM

    const area = (store: Record<string, unknown>) => ({
      get: (defaults: Record<string, unknown>, cb: (items: Record<string, unknown>) => void) =>
        cb(Object.fromEntries(Object.entries(defaults).map(([k, v]) => [k, k in store ? store[k] : v]))),
      set: (items: Record<string, unknown>, cb?: () => void) => { Object.assign(store, items); cb?.() },
    })
    const on = (name: string) => ({ addListener: (fn: Listener) => listeners[name].push(fn) })
    const chromeMock = {
      runtime: { onInstalled: on('installed'), onStartup: on('startup'), onMessageExternal: on('external'), getManifest: () => ({ version: '9.9.9' }) },
      storage: { sync: area({}), local: area(local), onChanged: on('changed') },
      contextMenus: {
        create: (props: { id: string; title?: string }, cb?: () => void) => { menus.push(props); cb?.() },
        removeAll: (cb?: () => void) => { menus.length = 0; cb?.() },
        onClicked: on('clicked'),
      },
      tabs: { create: ({ url }: { url: string }) => { opened.push(url) } },
      action: { setBadgeText() {}, setBadgeBackgroundColor() {}, setTitle() {} },
      scripting: {
        // What executeScript really does: ship the function's source into the page and run it there.
        async executeScript({ func, args = [] }: Injected) {
          const inPage = dom.window.eval(`(${func.toString()})`) as (...a: unknown[]) => unknown
          return [{ frameId: 0, result: await inPage(...args) }]
        },
      },
    }

    function pageWithSelection(value: string, start: number, end: number): HTMLTextAreaElement {
      dom = new JSDOM('<textarea></textarea>', { runScripts: 'outside-only', url: 'https://page.test/' })
      const textarea = dom.window.document.querySelector('textarea')!
      textarea.value = value
      textarea.focus()
      textarea.setSelectionRange(start, end)
      return textarea
    }

    const click = async (menuItemId: string, selectionText: string) => {
      await listeners.clicked[0]({ menuItemId, selectionText, frameId: 0, editable: true }, { id: 1 })
      // the listener fires handleClick without awaiting it; let it settle
      for (let i = 0; i < 50 && !settled(); i++) await new Promise(r => setTimeout(r, 20))
    }
    let settled = () => true

    beforeAll(() => {
      const code = read('background.js')
        .replace(/export\s*\{[^}]*\}\s*;?\s*$/, '')
        // `import.meta` is a syntax error outside a module; stand in for it with just a `url`, so
        // code that feature-detects `import.meta.resolve` takes its `new URL(…, import.meta.url)` path
        .replaceAll('import.meta', '__importMeta')
      expect(typeof (globalThis as { document?: unknown }).document).toBe('undefined')
      const importMeta = { url: pathToFileURL(resolve(distDir, 'background.js')).href }
      new Function('chrome', '__importMeta', `"use strict";\n${code}`)(chromeMock, importMeta)
    })

    it('registers its listeners at top level and builds the default menu on install', async () => {
      expect(listeners.clicked).toHaveLength(1)
      await listeners.installed[0]()
      await new Promise(r => setTimeout(r, 0))
      expect(menus.map(m => m.id)).toContain('subelt-apply:sha3')
      expect(menus.at(-1)?.id).toBe('subelt-open-in-app')
    })

    it('hashes a selection with sha3 (WASM) and writes it back into the page', async () => {
      const textarea = pageWithSelection('x abc y', 2, 5)
      settled = () => textarea.value !== 'x abc y'
      await click('subelt-apply:sha3', 'abc')
      expect(textarea.value).toBe('x 3a985da74fe225b2045c172d6bd390bd855f086e3e9d525b46bfe24511431532 y')
    })

    it('keeps line breaks the menu\'s selectionText loses', async () => {
      const textarea = pageWithSelection('a\nb', 0, 3)
      settled = () => textarea.value !== 'a\nb'
      await click('subelt-apply:base64_encode', 'a b')
      expect(textarea.value).toBe('YQpi')
    })

    it('saves a pipeline sent by the web app, then runs it from the menu', async () => {
      const steps = [{ id: 'a', utilityId: 'trim' }, { id: 'b', utilityId: 'base64_encode' }]
      const result = await new Promise(resolve => listeners.external[0](
        { source: 'subelt-app', protocol: 1, type: 'request', request: { type: 'save-pipeline', name: 'Trim + encode', steps } },
        { tab: { id: 1 }, frameId: 0, url: 'https://stringutilitybelt.com/' },
        resolve,
      ))
      expect(result).toMatchObject({ ok: true })
      const [{ id }] = local.pipelines as Array<{ id: string }>

      const textarea = pageWithSelection(' hi ', 0, 4)
      settled = () => textarea.value !== ' hi '
      await click(`subelt-run:${id}`, ' hi ')
      expect(textarea.value).toBe('aGk=')
    })

    it('a production build refuses messages from a local dev server', async () => {
      const result = await new Promise(resolve => listeners.external[0](
        { source: 'subelt-app', protocol: 1, type: 'ping' },
        { tab: { id: 1 }, frameId: 0, url: 'http://localhost:5173/' },
        resolve,
      ))
      expect(result).toEqual({ ok: false, error: 'The extension refused this request.' })
    })

    it('opens the selection in the app', async () => {
      pageWithSelection('one\ntwo', 0, 7)
      settled = () => opened.length > 0
      await click('subelt-open-in-app', 'one two')
      expect(opened).toEqual(['https://stringutilitybelt.com/?text=one%0Atwo'])
    })
  })
})
