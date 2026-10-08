// Build the extension first: npm run build:extension
// Then: node packages/extension/store-listing/generate.mjs
// Uses a temporary Chromium profile, the real unpacked extension and a build of the website made for
// it (the unpacked extension's id added with VITE_EXTENSION_IDS), served at https://stringutilitybelt.com
// so the extension's "save to extension" bridge answers it as it answers the live site.
// Downloads the design's typefaces (Instrument Sans, JetBrains Mono) from Google Fonts, so it needs network.
import { chromium } from '@playwright/test'
import { readFile, writeFile, copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dir, '../../..')
const assetDir = path.join(dir, 'assets')
const sourceDir = path.join(dir, 'sources')
const SITE = 'https://stringutilitybelt.com'
await mkdir(assetDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })
const data = (buf, type = 'image/png') => `data:${type};base64,${buf.toString('base64')}`
// the brand mark (scripts/icons.ts): the lockup in the artwork, and the extension's menu icon
const mark = data(await readFile(path.join(root, 'public/icons/icon-512.png')))
const menuIcon = data(await readFile(path.join(root, 'packages/extension/icons/icon32.png')))

/**
 * The Latin subset of a Google Fonts family as `@font-face` rules with the font files inlined,
 * so the captured pages and the artwork render in the design's typefaces in any Chromium.
 */
async function googleFont(query) {
  const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36'
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}&display=swap`, { headers: { 'user-agent': ua } })).text()
  const latin = css.split('/* ').filter(block => block.startsWith('latin */')).map(block => block.slice('latin */'.length))
  if (!latin.length) throw new Error(`No Latin faces in the Google Fonts response for ${query}`)
  const faces = await Promise.all(latin.map(async face => {
    const url = face.match(/url\((https:[^)]+)\)/)[1]
    const font = Buffer.from(await (await fetch(url)).arrayBuffer())
    return face.replace(url, data(font, 'font/woff2'))
  }))
  return faces.join('\n')
}
const fonts = (await googleFont('family=Instrument+Sans:wght@400;500;600;700')) + '\n' + (await googleFont('family=JetBrains+Mono:wght@400;500'))
// what the saved, editable sources load instead of ~240 KB of inlined font files each
const fontsImport = "@import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');"

// The site's tokens (src/index.css), light and dark.
const THEMES = {
  light: { bg: '#f8f7f3', strip: '#f2f0ec', surface: '#fefdfa', line: '#dcd9d3', line2: '#beb9b3', ink: '#1f1915', muted: '#69625d', acc: '#ca4b20', soft: '#ffe8dc', shadow: 'rgb(40 30 22 / .22)' },
  dark: { bg: '#110f0d', strip: '#171412', surface: '#1a1614', line: '#312d29', line2: '#4c4742', ink: '#eae7e3', muted: '#a39d98', acc: '#ea7b4e', soft: '#3d2014', shadow: 'rgb(0 0 0 / .6)' },
}

// The pipeline every screenshot follows: built on the website, saved to the extension, run from it.
const PIPELINE_NAME = 'Tidy an email list'
const PIPELINE_STEPS = [
  { id: 'each', type: 'each', split: { mode: 'lines' }, skipEmpty: true, enabled: true, steps: [
    { id: 'trim', utilityId: 'trim', enabled: true, params: {} },
    { id: 'lower', utilityId: 'case', enabled: true, params: { mode: 'lower' } },
  ] },
  { id: 'dedupe', utilityId: 'line_dedupe', enabled: true, params: {} },
  { id: 'sort', utilityId: 'line_sort', enabled: true, params: {} },
]
const PIPELINE_INPUT = '  Ada@Example.com\nbob@example.org\nCarol@Example.NET  \nada@example.com\n  BOB@example.org'
const PIPELINE_OUTPUT = 'ada@example.com\nbob@example.org\ncarol@example.net'

const CONTENT_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.wasm': 'application/wasm', '.md': 'text/markdown', '.txt': 'text/plain' }

const profile = await mkdtemp(path.join(tmpdir(), 'subelt-store-'))
const dist = await mkdtemp(path.join(tmpdir(), 'subelt-store-site-'))
const extension = path.join(root, 'packages/extension/dist')
const context = await chromium.launchPersistentContext(profile, {
  // CHROMIUM_PATH: a Chromium build to use instead of Playwright's own (e.g. a preinstalled one)
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2, colorScheme: 'light',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})
const results = { extensionVersion: JSON.parse(await readFile(path.join(extension, 'manifest.json'))).version }
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host

  // The website, built from this checkout to also talk to this unpacked extension (the live site
  // knows only the store's id), served at its real address; nothing is reported to analytics.
  const build = spawnSync('npx', ['vite', 'build', '--outDir', dist, '--emptyOutDir', '--logLevel', 'error'],
    { cwd: root, stdio: 'inherit', env: { ...process.env, VITE_EXTENSION_IDS: extensionId } })
  if (build.status !== 0) throw new Error('The website build failed')
  await context.route(/googletagmanager\.com|google-analytics\.com|doubleclick\.net|google\.com\/(ccm|pagead)/, route => route.abort())
  await context.route(`${SITE}/**`, async route => {
    const { pathname } = new URL(route.request().url())
    const wanted = path.join(dist, decodeURIComponent(pathname), pathname.endsWith('/') ? 'index.html' : '')
    const file = wanted.startsWith(dist) ? wanted : path.join(dist, 'index.html')
    const body = await readFile(file).catch(() => readFile(path.join(dist, 'index.html')))
    await route.fulfill({ status: 200, body, contentType: CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream' })
  })

  const errors = []
  const watch = page => page.on('pageerror', e => errors.push(`${page.url()}: ${e.message}`))

  // 1. The pipeline on the website.
  const site = await context.newPage()
  watch(site)
  await site.setViewportSize({ width: 1440, height: 1000 })
  await site.goto(`${SITE}/?analytics=off`)
  await site.evaluate(([name, steps]) => {
    localStorage.setItem('string-utility-belt', JSON.stringify({ v: 3, name, steps, showPreviews: true }))
    localStorage.setItem('sub:pref:theme', JSON.stringify('light'))
    localStorage.setItem('sub:pref:integrationsSeen', 'true')
  }, [PIPELINE_NAME, PIPELINE_STEPS])
  await site.reload()
  await site.addStyleTag({ content: fonts })
  await site.locator('#pipeline-input').fill(PIPELINE_INPUT)
  const result = site.getByRole('region', { name: 'Result' })
  await result.filter({ hasText: 'carol@example.net' }).waitFor()
  const output = (await result.innerText()).trim()
  if (output !== PIPELINE_OUTPUT) throw new Error(`Unexpected pipeline output: ${output}`)
  results.website = { pipeline: PIPELINE_NAME, input: PIPELINE_INPUT, output }
  await site.locator('#pipeline-input').blur()
  await site.evaluate(() => document.fonts.ready)
  // the title row, the input and the first steps, in the frame's proportions (620 × 690): the
  // whole timeline is too tall to read at store size, so it fades out below the run-on-each step
  const titleBox = await site.getByRole('textbox', { name: /pipeline name/i }).boundingBox()
  const stepsBox = await site.getByRole('region', { name: 'Pipeline steps' }).boundingBox()
  const cropWidth = stepsBox.width + 48
  const pipelineRaw = await site.screenshot({ path: path.join(sourceDir, '01-build-a-pipeline-capture.png'), fullPage: true,
    clip: { x: stepsBox.x - 24, y: titleBox.y - 24, width: cropWidth, height: Math.round(cropWidth * 690 / 620) } })

  // 2. Saving the whole pipeline to the extension, through the website's own dialog.
  await site.getByRole('button', { name: 'Save to extension' }).click()
  const dialog = site.getByRole('dialog', { name: 'Save to extension' })
  await dialog.getByLabel('Pipeline name').fill(PIPELINE_NAME)
  await dialog.getByRole('button', { name: 'Save pipeline' }).click()
  const status = dialog.getByRole('status')
  await site.waitForFunction(el => !!el.textContent && el.textContent !== 'Saving…', await status.elementHandle())
  if (!(await status.getAttribute('class')).includes('text-add-ink')) throw new Error(`Save to extension failed: ${await status.textContent()}`)
  results.saveToExtension = (await status.textContent()).trim()
  await site.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  const dialogBox = await dialog.boundingBox()
  const dialogRaw = await site.screenshot({ path: path.join(sourceDir, '02-save-whole-pipeline-capture.png'),
    clip: dialogBox })

  // 3. The saved pipeline in the toolbar popup, run on the same text.
  const popup = await context.newPage()
  watch(popup)
  await popup.goto(`chrome-extension://${extensionId}/popup.html`)
  await popup.locator('#utility option').first().waitFor({ state: 'attached' })
  await popup.addStyleTag({ content: fonts })
  const options = await popup.locator('#utility option').evaluateAll(opts => opts.map(o => [o.value, o.textContent]))
  const nameOf = new Map(options)
  // every utility once (favourites are listed again at the top; saved pipelines are not utilities)
  const offered = new Set(options.map(([value]) => value).filter(value => value && !value.includes(':')))
  const savedOption = popup.locator('#utility optgroup[label="Saved pipelines"] option', { hasText: PIPELINE_NAME })
  await popup.locator('#utility').selectOption(await savedOption.getAttribute('value'))
  await popup.locator('#input').fill(PIPELINE_INPUT)
  await popup.locator('#run').click()
  await popup.waitForFunction(() => document.querySelector('#status').textContent === 'Done.')
  const popupOutput = await popup.locator('#output').inputValue()
  if (popupOutput !== PIPELINE_OUTPUT) throw new Error(`Unexpected popup output: ${popupOutput}`)
  results.popup = { ran: PIPELINE_NAME, summary: (await popup.locator('#pipeline-summary').textContent()).trim(), output: popupOutput, offeredUtilities: offered.size }
  await popup.locator('#run').blur()
  await popup.evaluate(() => document.fonts.ready)
  const popupRaw = await popup.locator('body').screenshot({ path: path.join(sourceDir, '04-every-step-one-click-capture.png') })

  // 4. The popup in the dark theme, working out a hash on the device.
  await popup.emulateMedia({ colorScheme: 'dark' })
  await popup.reload()
  await popup.locator('#utility option').first().waitFor({ state: 'attached' })
  await popup.addStyleTag({ content: fonts })
  await popup.locator('#utility').selectOption('hash')
  await popup.locator('#input').fill('my-api-key-1234')
  await popup.locator('#run').click()
  await popup.waitForFunction(() => document.querySelector('#status').textContent === 'Done.')
  const hashed = await popup.locator('#output').inputValue()
  if (hashed !== createHash('sha256').update('my-api-key-1234').digest('hex')) throw new Error(`Unexpected hash: ${hashed}`)
  results.darkPopup = { utility: 'hash', input: 'my-api-key-1234', output: hashed }
  await popup.locator('#run').blur()
  await popup.evaluate(() => document.fonts.ready)
  const darkRaw = await popup.locator('body').screenshot({ path: path.join(sourceDir, '05-private-by-design-capture.png') })

  // 5. The options page: the saved pipeline arrived, and the favourites the menu below shows.
  const optionsPage = await context.newPage()
  watch(optionsPage)
  await optionsPage.setViewportSize({ width: 1280, height: 1800 })
  await optionsPage.goto(`chrome-extension://${extensionId}/options.html`)
  await optionsPage.locator('#favorites li').first().waitFor()
  await optionsPage.addStyleTag({ content: fonts })
  // trim the default menu to the four a user here keeps, and save it, as the page asks
  while (await optionsPage.locator('#favorites li').count() > 4) await optionsPage.locator('#favorites li').last().getByRole('button', { name: /^Remove/ }).click()
  await optionsPage.locator('#save').click()
  await optionsPage.waitForFunction(() => document.querySelector('#status').textContent === 'Saved. The menu is updated.')
  await optionsPage.locator('#pipelines li').first().waitFor()
  const listed = await optionsPage.locator('#pipelines li input').first().inputValue()
  if (listed !== PIPELINE_NAME) throw new Error(`The options page lists ${listed}, not the saved pipeline`)
  results.options = { favourites: await optionsPage.locator('#favorites li').count(), savedPipeline: listed }
  await optionsPage.locator('#save').blur()
  await optionsPage.evaluate(() => document.fonts.ready)

  // The right-click menu is Chrome's own, which no page can capture: it is drawn with the exact
  // items the extension builds for this setup (packages/extension/src/lib/menu.ts): its favourites,
  // a separator, its saved pipelines, a separator, then "Open selection in String Utility Belt".
  const favourites = await optionsPage.evaluate(() => chrome.storage.sync.get('menuUtilities').then(v => v.menuUtilities))
  results.menu = [...favourites.map(id => `Apply: ${nameOf.get(id)}`), '—', `Pipeline: ${PIPELINE_NAME}`, '—', 'Open selection in String Utility Belt']
  if (errors.length) throw new Error(errors.join('\n'))

  // Compose the verified captures into the listing artwork, in the site's design.
  const render = await context.newPage()
  const base = t => `${fonts}
    :root{--bg:${t.bg};--strip:${t.strip};--surface:${t.surface};--line:${t.line};--line2:${t.line2};--ink:${t.ink};--muted:${t.muted};--acc:${t.acc};--soft:${t.soft};--shadow:${t.shadow}}
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;-webkit-font-smoothing:antialiased}
    body{font-family:'Instrument Sans',sans-serif;color:var(--ink);background:var(--bg)}
    .canvas{position:relative;width:100%;height:100%;overflow:hidden;background:var(--bg)}
    .brand{position:absolute;display:flex;align-items:center;gap:12px;font-weight:600;letter-spacing:-.01em}
    .brand img{display:block}
    .chrome-menu{position:absolute;background:#fff;border-radius:8px;padding:6px 0;box-shadow:0 2px 6px rgb(0 0 0 / .2),0 8px 24px rgb(0 0 0 / .14);font-family:'Instrument Sans',system-ui,sans-serif;font-size:14px;color:#1f1f1f}
    .chrome-menu .item{display:flex;align-items:center;gap:10px;height:32px;padding:0 16px;white-space:nowrap}
    .chrome-menu .item img{width:16px;height:16px}
    .chrome-menu .muted{color:#5f6368}.chrome-menu .open{background:#e8eaed}
    .chrome-menu .hit{background:var(--soft);color:var(--ink);font-weight:600}
    .chrome-menu .kind{color:#5f6368;font-weight:400}.chrome-menu .hit .kind{color:var(--acc)}
    .chrome-menu .arrow{margin-left:auto;color:#5f6368;font-size:18px}.chrome-menu .sep{height:1px;background:#e3e3e3;margin:6px 0}`
  const html = (css, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`
  async function exportHtml(name, markup, width, height) {
    await writeFile(path.join(sourceDir, `${name}.html`), markup.replace(fonts, fontsImport))
    await render.setViewportSize({ width, height })
    await render.setContent(markup)
    await render.evaluate(() => document.fonts.ready)
    // The CSS viewport is exact: capture at CSS scale for upload dimensions, not retina ones.
    await render.screenshot({ path: path.join(assetDir, `${name}.png`), scale: 'css' })
  }
  const ratio = raw => raw.readUInt32BE(16) / raw.readUInt32BE(20)
  const menuItems = items => items.map(item => item === '—'
    ? '<div class="sep"></div>'
    : `<div class="item${item.startsWith('Pipeline:') ? ' hit' : ''}">${item.replace(/^(Apply|Pipeline): /, '<span class="kind">$1:</span> ')}</div>`).join('')

  const screenshotCss = t => base(t) + `
    .brand{top:44px;left:60px;font-size:19px}.brand img{width:34px;height:34px}
    .copy{position:absolute;left:60px;top:180px;width:500px}
    .kicker{display:inline-flex;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:500;color:var(--acc)}
    .kicker b{display:grid;place-items:center;width:24px;height:24px;border:1px solid var(--acc);border-radius:6px;font-weight:500}
    h1{font-size:56px;line-height:62px;font-weight:600;letter-spacing:-.03em;margin:20px 0 22px}
    p{font-size:19px;line-height:30px;color:var(--muted);margin:0}
    .tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:30px}.tags span{font-size:14px;line-height:1;padding:9px 13px;border:1px solid var(--line2);border-radius:999px}
    .desk{position:absolute;left:600px;top:0;right:0;bottom:0;background:var(--strip);border-left:1px solid var(--line)}
    .shot-label{position:absolute;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted)}
    .shot{position:absolute;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface);box-shadow:0 30px 80px -30px var(--shadow)}
    .shot img{display:block;width:100%}
    .shot.continues:after{content:'';position:absolute;left:0;right:0;bottom:0;height:90px;background:linear-gradient(transparent,var(--surface))}
    .foot{position:absolute;left:60px;bottom:40px;display:flex;gap:18px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted)}
    .page{position:absolute;left:640px;top:146px;width:600px;height:520px;border:1px solid var(--line);border-radius:12px;background:var(--surface);overflow:hidden;box-shadow:0 30px 80px -30px var(--shadow)}
    .doc{padding:30px 32px;display:grid;gap:12px}.doc .line{height:12px;border-radius:6px;background:var(--line)}.doc .short{width:60%}
    .doc label{font-size:14px;color:var(--muted);margin-top:6px}
    .field{border:1px solid var(--line2);border-radius:8px;padding:12px 14px;font-family:'JetBrains Mono',monospace;font-size:15px;line-height:24px;white-space:pre}
    .sel{background:#b4d5fe;color:#1f1915}
    .chrome-menu.main{left:690px;top:384px;width:248px}.chrome-menu.sub{left:932px;top:493px;width:300px}`
  const frame = (c, i, t, panel) => html(screenshotCss(t), `<main class="canvas"><div class="desk"></div>
    <div class="brand"><img src="${mark}" alt="">String Utility Belt</div>
    <div class="copy"><div class="kicker"><b>${i + 1}</b>${c.kicker}</div><h1>${c.title}</h1><p>${c.text}</p><div class="tags">${c.tags.map(tag => `<span>${tag}</span>`).join('')}</div></div>
    ${panel}
    <div class="foot"><span>For Chrome, Edge and Brave</span><span>0${i + 1} / 05</span></div></main>`)
  /** A capture centred in the right-hand panel, as large as `maxW` × `maxH` allow. */
  const placed = (raw, label, maxW, maxH, continues = false) => {
    const width = Math.round(Math.min(maxW, maxH * ratio(raw)))
    const height = width / ratio(raw)
    const left = Math.round(600 + (680 - width) / 2)
    const top = Math.round((800 - height) / 2 + 12)
    return `<div class="shot-label" style="left:${left}px;top:${top - 26}px">${label}</div><div class="shot${continues ? ' continues' : ''}" style="left:${left}px;top:${top}px;width:${width}px"><img src="${data(raw)}"></div>`
  }
  /** Chrome's context menu with the extension's submenu open, over a page with text selected. */
  const menuPanel = items => `<div class="shot-label" style="left:640px;top:120px">Right-click menu</div>
    <div class="page"><div class="doc"><div class="line short"></div><div class="line"></div><label>Newsletter list</label>
      <div class="field"><span class="sel">${PIPELINE_INPUT.replace(/\n/g, '<br>')}</span></div>
      <div class="line"></div><div class="line short"></div></div></div>
    <div class="chrome-menu main"><div class="item muted">Cut</div><div class="item muted">Copy</div><div class="item muted">Paste</div><div class="sep"></div>
      <div class="item open"><img src="${menuIcon}" alt="">String Utility Belt<span class="arrow">›</span></div><div class="sep"></div><div class="item muted">Inspect</div></div>
    <div class="chrome-menu sub">${menuItems(items)}</div>`

  const screens = [
    { file: '01-build-a-pipeline', theme: 'light', kicker: 'Pipelines', title: 'Chain utilities<br>into a pipeline.',
      text: 'Build it on stringutilitybelt.com and watch the text change after every step.', tags: ['Run on each line', 'Branches', 'A preview per step'],
      panel: () => placed(pipelineRaw, 'stringutilitybelt.com', 620, 690, true) },
    { file: '02-save-whole-pipeline', theme: 'light', kicker: 'Save to extension', title: 'Save the whole<br>pipeline.',
      text: 'One click sends every step and setting to your browser. Nothing to copy, nothing to rebuild.', tags: ['Every step', 'Every setting', 'Same name updates it'],
      panel: () => placed(dialogRaw, 'stringutilitybelt.com', 600, 640) },
    { file: '03-right-click-any-selection', theme: 'light', kicker: 'Right-click', title: 'Run it on any<br>selection.',
      text: 'Pick a favourite utility or a saved pipeline. In a text field, the result replaces what you selected.', tags: ['Favourites', 'Saved pipelines', 'Replaces in place'],
      panel: () => menuPanel(results.menu) },
    { file: '04-every-step-one-click', theme: 'light', kicker: 'Toolbar popup', title: 'Every step,<br>one click.',
      text: 'Paste text, pick the saved pipeline and get the finished result, with every setting it was saved with.', tags: [`${offered.size} utilities`, 'Saved pipelines', 'Copy the result'],
      panel: () => placed(popupRaw, 'Toolbar popup', 470, 640) },
    { file: '05-private-by-design', theme: 'dark', kicker: 'Private by design', title: 'Runs on<br>your device.',
      text: 'Every utility runs in your browser. No analytics, no ads, no network requests. Light and dark follow your system.', tags: ['Works offline', 'Open source', 'No account'],
      panel: () => placed(darkRaw, 'Toolbar popup', 470, 640) },
  ]
  for (let i = 0; i < screens.length; i++) await exportHtml(screens[i].file, frame(screens[i], i, THEMES[screens[i].theme], screens[i].panel()), 1280, 800)

  // The store icon is the extension's own 128 px icon: the same mark, a 96 px tile in a 16 px margin.
  await copyFile(path.join(root, 'packages/extension/icons/icon128.png'), path.join(assetDir, 'store-icon-128.png'))

  const promoCss = base(THEMES.light) + `
    .card{border:1px solid var(--line);border-radius:10px;background:var(--surface);box-shadow:0 20px 50px -24px var(--shadow)}
    .note{position:absolute;font-family:'JetBrains Mono',monospace;color:var(--muted)}
    .label{position:absolute;font-family:'JetBrains Mono',monospace;color:var(--muted)}`
  await exportHtml('small-promo-440x280', html(promoCss + `
      .brand{left:28px;top:26px;font-size:19px}.brand img{width:30px;height:30px}
      h1{position:absolute;left:28px;top:74px;margin:0;font-size:31px;line-height:35px;font-weight:600;letter-spacing:-.03em}
      .chrome-menu{left:28px;top:168px;width:250px;font-size:13px;padding:4px 0}.chrome-menu .item{height:28px;padding:0 12px}
      .note{left:300px;top:186px;width:120px;font-size:11px;line-height:17px}`,
    `<main class="canvas"><div class="brand"><img src="${mark}" alt="">String Utility Belt</div>
      <h1>Your pipelines,<br>one right-click away.</h1>
      <div class="chrome-menu">${menuItems(results.menu.slice(results.menu.indexOf('—') + 1, results.menu.lastIndexOf('—')))}<div class="item"><span class="kind">Apply:</span>&nbsp;${nameOf.get(favourites[0])}</div></div>
      <div class="note">${offered.size} utilities.<br>Runs on your device.</div></main>`), 440, 280)
  await exportHtml('marquee-promo-1400x560', html(promoCss + `
      .brand{left:72px;top:60px;font-size:24px}.brand img{width:42px;height:42px}
      h1{position:absolute;left:72px;top:150px;margin:0;font-size:62px;line-height:68px;font-weight:600;letter-spacing:-.035em}
      .note{left:74px;bottom:60px;font-size:15px}
      .desk{position:absolute;left:720px;top:0;right:0;bottom:0;background:var(--strip);border-left:1px solid var(--line)}
      .label{font-size:13px}
      .steps{position:absolute;left:770px;top:110px;width:300px}
      .step{display:grid;grid-template-columns:34px 1fr;column-gap:14px}
      .num{display:flex;flex-direction:column;align-items:center}.num span{width:30px;height:30px;display:grid;place-items:center;border:1px solid var(--line2);border-radius:7px;background:var(--surface);font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:500}
      .num i{flex:1;width:1px;background:var(--line2);min-height:14px}
      .step .card{margin-bottom:14px;padding:12px 15px;font-size:17px;font-weight:600}
      .step .card small{display:block;margin-top:3px;font-size:13px;font-weight:400;color:var(--muted)}
      .arrow{position:absolute;left:1092px;top:246px;font-family:'JetBrains Mono',monospace;font-size:28px;color:var(--acc)}
      .chrome-menu{left:1132px;top:190px;width:240px;font-size:13px}.chrome-menu .item{height:30px;padding:0 12px}`,
    `<main class="canvas"><div class="desk"></div>
      <div class="brand"><img src="${mark}" alt="">String Utility Belt</div>
      <h1>Build a pipeline.<br>Run it on any<br>selection.</h1>
      <div class="note">${offered.size} utilities · runs on your device · no account</div>
      <div class="label" style="left:770px;top:76px">On the website</div>
      <div class="steps">
        <div class="step"><div class="num"><span>01</span><i></i></div><div class="card">On each line<small>trim, then lower case</small></div></div>
        <div class="step"><div class="num"><span>02</span><i></i></div><div class="card">dedupe lines<small>drop the repeats</small></div></div>
        <div class="step"><div class="num"><span>03</span></div><div class="card">sort lines<small>alphabetical</small></div></div>
      </div>
      <div class="arrow">→</div>
      <div class="label" style="left:1132px;top:156px">In your browser</div>
      <div class="chrome-menu">${menuItems(results.menu.slice(0, 2))}<div class="sep"></div>${menuItems([`Pipeline: ${PIPELINE_NAME}`])}</div></main>`), 1400, 560)

  const thumbs = await Promise.all([...screens.map(s => s.file), 'small-promo-440x280', 'marquee-promo-1400x560', 'store-icon-128']
    .map(async name => ({ name, url: data(await readFile(path.join(assetDir, `${name}.png`))) })))
  await exportHtml('contact-sheet', html(base(THEMES.light) + `.gallery{padding:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px}figure{margin:0;height:280px;background:var(--surface);border:1px solid var(--line);padding:12px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center}figure img{max-width:100%;max-height:230px;object-fit:contain}figcaption{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted);padding-top:9px}`,
    `<div class="gallery">${thumbs.map(t => `<figure><img src="${t.url}"><figcaption>${t.name}</figcaption></figure>`).join('')}</div>`), 1440, 950)
  // The contact sheet is a review aid, kept outside the upload directory.
  await writeFile(path.join(dir, 'contact-sheet.png'), await readFile(path.join(assetDir, 'contact-sheet.png')))
  await rm(path.join(assetDir, 'contact-sheet.png'))
  await writeFile(path.join(dir, 'capture-verification.json'), JSON.stringify({
    ...results,
    source: 'The real unpacked extension and this repository\'s website build, in isolated Chromium, with no mocked Chrome APIs. Only the right-click menu, which is Chrome\'s own, is drawn, with the items the extension created.',
    fonts: 'Instrument Sans and JetBrains Mono, the typefaces the site and the extension name first, loaded into the captured pages.',
    pageErrors: errors,
  }, null, 2) + '\n')
  console.log(`Created 8 upload assets and the contact sheet. Pipeline saved from the website and run in the popup; ${offered.size} utilities offered.`)
} finally {
  await context.close()
  // Only remove the temporary profile and site build made by this script, never a user's browser profile.
  for (const made of [profile, dist]) {
    if (path.dirname(made) === path.resolve(tmpdir()) && path.basename(made).startsWith('subelt-store-')) await rm(made, { recursive: true, force: true })
  }
}
