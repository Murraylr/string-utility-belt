// Rebuild first: npm run build:extension
// Then: node packages/extension/store-listing/generate.mjs
// Uses a temporary Chromium profile and the real unpacked extension. Downloads the design's two
// typefaces (Instrument Sans, JetBrains Mono) from Google Fonts at run time, so it needs network.
import { chromium } from '@playwright/test'
import LZString from 'lz-string'
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dir, '../../..')
const assetDir = path.join(dir, 'assets')
const sourceDir = path.join(dir, 'sources')
await mkdir(assetDir, { recursive: true })
await mkdir(sourceDir, { recursive: true })
const data = (buf, type = 'image/png') => `data:${type};base64,${buf.toString('base64')}`
// The installed extension's own icon: the store icon must match what the toolbar shows.
const icon = data(await readFile(path.join(root, 'public/icons/icon-512.png')))

/**
 * The Latin subset of a Google Fonts family as `@font-face` rules with the font files inlined,
 * so the extension pages and the artwork render in the design's typefaces in any Chromium.
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
  light: { bg: '#f8f7f3', strip: '#f2f0ec', surface: '#fefdfa', line: '#dcd9d3', line2: '#beb9b3', ink: '#1f1915', muted: '#69625d', acc: '#ca4b20', shadow: 'rgb(40 30 22 / .22)' },
  dark: { bg: '#110f0d', strip: '#171412', surface: '#1a1614', line: '#312d29', line2: '#4c4742', ink: '#eae7e3', muted: '#a39d98', acc: '#ea7b4e', shadow: 'rgb(0 0 0 / .6)' },
}

/** A pipeline as the website's share link carries it (`encodeShare`). */
const shareLink = doc => `https://stringutilitybelt.com/#/p/${LZString.compressToEncodedURIComponent(JSON.stringify(doc))}`

const profile = await mkdtemp(path.join(tmpdir(), 'subelt-store-'))
const extension = path.join(root, 'packages/extension/dist')
const context = await chromium.launchPersistentContext(profile, {
  // CHROMIUM_PATH: a Chromium build to use instead of Playwright's own (e.g. a preinstalled one)
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : { channel: 'chromium' }),
  headless: true, viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 2, colorScheme: 'light',
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
})
const results = []
try {
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
  const extensionId = new URL(worker.url()).host
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  const useFonts = () => page.addStyleTag({ content: fonts }).then(() => page.evaluate(() => document.fonts.ready))

  const examples = [
    { file: '01-decode-base64', utility: 'base64_decode', input: 'SGVsbG8sIGRldmVsb3BlciE=', expected: 'Hello, developer!', theme: 'light',
      kicker: 'Decode and encode', title: 'Decode it where<br>you found it.', text: 'Select the text, right-click, done. Or paste it<br>into the toolbar popup.', tags: ['Base64', 'URL encoding', 'JWT'] },
    { file: '02-format-json', utility: 'json_pretty', input: '{"name":"Ada","role":"developer","active":true}', expected: '{\n  "name": "Ada",\n  "role": "developer",\n  "active": true\n}', outputHeight: 112, theme: 'light',
      kicker: 'Format and inspect', title: 'Make JSON<br>readable.', text: 'Pretty-print a compact payload, pick the indent<br>and copy the result.', tags: ['JSON', 'YAML', 'SQL'] },
    { file: '03-change-case', utility: 'case', param: 'title', input: 'make every word count', expected: 'Make Every Word Count', theme: 'light',
      kicker: 'Everyday text', title: 'Get text<br>into shape.', text: 'Change case, trim whitespace and tidy up<br>text with the right utility for the job.', tags: ['Title case', 'Trim', 'Slugify'] },
    { file: '04-hash-text', utility: 'hash', input: 'hello', expected: createHash('sha256').update('hello').digest('hex'), theme: 'dark',
      kicker: 'Light or dark', title: 'Hash text<br>in two clicks.', text: 'SHA-256 and friends, worked out on your device.<br>The popup follows your system theme.', tags: ['SHA-256', 'SHA-384', 'SHA-512'] },
  ]
  const captures = []
  for (const ex of examples) {
    await page.emulateMedia({ colorScheme: ex.theme })
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.locator('#utility option').first().waitFor({ state: 'attached' })
    await useFonts()
    // favourites are listed again at the top of the menu: count each utility once
    const count = new Set(await page.locator('#utility option').evaluateAll(options => options.map(o => o.value).filter(Boolean))).size
    await page.locator('#utility').selectOption(ex.utility)
    if (ex.param) await page.locator('#params select').first().selectOption(ex.param)
    await page.locator('#input').fill(ex.input)
    await page.locator('#run').click()
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Done.')
    const output = await page.locator('#output').inputValue()
    if (output !== ex.expected) throw new Error(`Unexpected output for ${ex.utility}: ${output}`)
    // Resizing the result box is a native part of the popup: give multi-line JSON the room it needs.
    if (ex.outputHeight) await page.locator('#output').evaluate((el, h) => { el.style.height = `${h}px` }, ex.outputHeight)
    await page.locator('#run').blur()
    const raw = await page.locator('body').screenshot({ path: path.join(sourceDir, `${ex.file}-capture.png`) })
    captures.push({ ...ex, raw: data(raw), ratio: raw.readUInt32BE(16) / raw.readUInt32BE(20), label: 'Toolbar popup' })
    results.push({ example: ex.utility, theme: ex.theme, input: ex.input, output, offeredUtilities: count })
  }

  // The options page with a saved pipeline, added the way a user would: from a share link.
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto(`chrome-extension://${extensionId}/options.html`)
  await page.locator('#favorites li').first().waitFor()
  await useFonts()
  // Trim the default menu to the four a user here keeps, and save it, as the page asks.
  while (await page.locator('#favorites li').count() > 4) await page.locator('#favorites li').last().getByRole('button', { name: /^Remove/ }).click()
  await page.locator('#save').click()
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Saved. The menu is updated.')
  const pipeline = { v: 2, name: 'Clean up a URL slug', steps: [
    { id: 'a', utilityId: 'trim', enabled: true, params: {} },
    { id: 'b', utilityId: 'slug', enabled: true, params: {} },
  ] }
  await page.locator('#import-link').fill(shareLink(pipeline))
  await page.locator('#import').click()
  await page.waitForFunction(name => document.querySelector('#pipeline-status').textContent === `Added “${name}”.`, pipeline.name)
  // the list re-renders from the storage change, a moment after the status line
  await page.locator('#pipelines li').first().waitFor()
  const listed = await page.locator('#pipelines li input').first().inputValue()
  if (listed !== pipeline.name) throw new Error(`Imported pipeline listed as ${listed}`)
  await page.locator('#import').blur()
  const favourites = await page.locator('#favorites li').count()
  // The page from its title to the saved pipelines: everything the menu shows, nothing below.
  // a window tall enough for the whole column, so the capture never stops at the fold
  await page.setViewportSize({ width: 1280, height: 1600 })
  const column = await page.locator('main.page').boundingBox()
  const top = await page.locator('.intro').boundingBox()
  const end = await page.locator('#pipelines').boundingBox()
  const pad = 28
  const optionsRaw = await page.screenshot({ path: path.join(sourceDir, '05-customize-menu-capture.png'),
    clip: { x: column.x - pad, y: Math.max(0, top.y - pad), width: column.width + 2 * pad, height: end.y + end.height + 14 - Math.max(0, top.y - pad) } })
  results.push({ example: 'options', favourites, importedPipeline: pipeline.name })
  captures.push({ file: '05-customize-menu', raw: data(optionsRaw), ratio: optionsRaw.readUInt32BE(16) / optionsRaw.readUInt32BE(20), options: true, theme: 'light', label: 'Extension options',
    kicker: 'Your menu', title: 'Your favourites,<br>one right-click away.', text: 'Order the utilities you use most, and save whole<br>pipelines from the website to run in one step.', tags: ['Favourites', 'Saved pipelines', 'Share links'] })
  if (errors.length) throw new Error(errors.join('\n'))

  // Compose the verified captures into the listing artwork, in the site's design.
  const render = await context.newPage()
  const base = t => `${fonts}
    :root{--bg:${t.bg};--strip:${t.strip};--surface:${t.surface};--line:${t.line};--line2:${t.line2};--ink:${t.ink};--muted:${t.muted};--acc:${t.acc};--shadow:${t.shadow}}
    *{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;-webkit-font-smoothing:antialiased}
    body{font-family:'Instrument Sans',sans-serif;color:var(--ink);background:var(--bg)}
    .canvas{position:relative;width:100%;height:100%;overflow:hidden;background:var(--bg)}
    .brand{position:absolute;display:flex;align-items:center;gap:12px;font-size:19px;font-weight:600;letter-spacing:-.01em}
    .keycap{font-family:'JetBrains Mono',monospace;font-weight:500;line-height:1;border:1.5px solid var(--ink);border-bottom-width:3px;border-radius:6px}
    .mono{font-family:'JetBrains Mono',monospace}`
  const html = (css, body) => `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`
  async function exportHtml(name, markup, width, height, transparent = false) {
    await writeFile(path.join(sourceDir, `${name}.html`), markup.replace(fonts, fontsImport))
    await render.setViewportSize({ width, height })
    await render.setContent(markup)
    await render.evaluate(() => document.fonts.ready)
    // The CSS viewport is exact: capture at CSS scale for upload dimensions, not retina ones.
    await render.screenshot({ path: path.join(assetDir, `${name}.png`), scale: 'css', omitBackground: transparent })
  }

  const screenshotCss = t => base(t) + `
    .brand{top:46px;left:60px}.brand .keycap{font-size:13px;padding:6px 7px 5px}
    .copy{position:absolute;left:60px;top:196px;width:500px}
    .kicker{font-family:'JetBrains Mono',monospace;font-size:13px;font-weight:500;color:var(--acc)}
    h1{font-size:58px;line-height:64px;font-weight:600;letter-spacing:-.03em;margin:20px 0 22px}
    p{font-size:19px;line-height:30px;color:var(--muted);margin:0}
    .tags{display:flex;gap:8px;margin-top:30px}.tags span{font-size:14px;line-height:1;padding:9px 13px;border:1px solid var(--line2);border-radius:999px}
    .desk{position:absolute;left:600px;top:0;right:0;bottom:0;background:var(--strip);border-left:1px solid var(--line)}
    .shot-label{position:absolute;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted)}
    .shot{position:absolute;border:1px solid var(--line);border-radius:12px;overflow:hidden;background:var(--surface);box-shadow:0 30px 80px -30px var(--shadow)}
    .shot img{display:block;width:100%}
    .foot{position:absolute;left:60px;bottom:40px;display:flex;gap:18px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted)}`
  for (let i = 0; i < captures.length; i++) {
    const c = captures[i]
    const t = THEMES[c.theme]
    // centred in the right-hand panel, as large as its height allows
    const maxW = c.options ? 600 : 470
    const width = Math.round(Math.min(maxW, (c.options ? 680 : 620) * c.ratio))
    const height = width / c.ratio
    const left = Math.round(600 + (680 - width) / 2)
    const topY = Math.round((800 - height) / 2 + 12)
    const markup = html(screenshotCss(t) + `.shot{left:${left}px;top:${topY}px;width:${width}px}.shot-label{left:${left}px;top:${topY - 26}px}`,
      `<main class="canvas"><div class="desk"></div>
        <div class="brand"><span class="keycap">sub</span>String Utility Belt</div>
        <div class="copy"><div class="kicker">${c.kicker}</div><h1>${c.title}</h1><p>${c.text}</p><div class="tags">${c.tags.map(tag => `<span>${tag}</span>`).join('')}</div></div>
        <div class="shot-label">${c.label}</div><div class="shot"><img src="${c.raw}"></div>
        <div class="foot"><span>For Chrome, Edge and Brave</span><span>0${i + 1} / 05</span></div></main>`)
    await exportHtml(c.file, markup, 1280, 800)
  }

  // The store icon is the extension's own toolbar icon, centred in the store's 96 px safe area.
  await exportHtml('store-icon-128', html('html,body{margin:0;background:transparent}', `<img src="${icon}" style="position:absolute;left:16px;top:16px;width:96px;height:96px">`), 128, 128, true)

  const promoCss = base(THEMES.light) + `
    .flow{position:absolute;display:flex;align-items:center}
    .card{font-family:'JetBrains Mono',monospace;border:1px solid var(--line);border-radius:10px;background:var(--surface);box-shadow:0 20px 50px -24px var(--shadow)}
    .card.out{border-color:var(--acc);color:var(--acc)}
    .arrow{color:var(--acc);font-family:'JetBrains Mono',monospace}
    .note{position:absolute;font-family:'JetBrains Mono',monospace;color:var(--muted)}`
  await exportHtml('small-promo-440x280', html(promoCss + `
      .brand{left:28px;top:30px;font-size:22px}.brand .keycap{font-size:14px;padding:6px 7px 5px}
      h1{position:absolute;left:28px;top:82px;margin:0;font-size:34px;line-height:38px;font-weight:600;letter-spacing:-.03em}
      .flow{left:28px;top:178px;gap:12px}.card{font-size:18px;padding:12px 15px}.arrow{font-size:18px}
      .note{left:28px;bottom:16px;font-size:11px}`,
    `<main class="canvas"><div class="brand"><span class="keycap">sub</span>String Utility Belt</div>
      <h1>Text tools on<br>your right-click.</h1>
      <div class="flow"><div class="card">aGVsbG8=</div><span class="arrow">→</span><div class="card out">hello</div></div></main>`), 440, 280)
  await exportHtml('marquee-promo-1400x560', html(promoCss + `
      .brand{left:72px;top:64px;font-size:24px}.brand .keycap{font-size:15px;padding:7px 8px 6px}
      h1{position:absolute;left:72px;top:170px;margin:0;font-size:72px;line-height:78px;font-weight:600;letter-spacing:-.035em}
      .note{left:74px;bottom:66px;font-size:15px}
      .desk{position:absolute;left:760px;top:0;right:0;bottom:0;background:var(--strip);border-left:1px solid var(--line)}
      .steps{position:absolute;left:830px;top:96px;display:grid;gap:0;width:500px}
      .step{display:grid;grid-template-columns:40px 1fr;column-gap:16px}
      .num{display:flex;flex-direction:column;align-items:center}.num span{width:36px;height:36px;display:grid;place-items:center;border:1px solid var(--line2);border-radius:8px;background:var(--surface);font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:500}
      .num i{flex:1;width:1px;background:var(--line2);min-height:16px}
      .step .card{margin-bottom:18px;padding:14px 18px 15px;font-family:'Instrument Sans',sans-serif}
      .step .card b{display:block;font-size:19px;font-weight:600}
      .step .card code{display:block;margin-top:8px;padding:8px 10px;border-radius:6px;background:var(--strip);font-family:'JetBrains Mono',monospace;font-size:15px;color:var(--muted)}
      .step:last-child .card{border-color:var(--acc)}.step:last-child code{color:var(--ink)}`,
    `<main class="canvas"><div class="desk"></div>
      <div class="brand"><span class="keycap">sub</span>String Utility Belt</div>
      <h1>Text tools on<br>your right-click.</h1>
      <div class="note">Decode · Format · Hash · 240+ utilities</div>
      <div class="steps">
        <div class="step"><div class="num"><span>01</span><i></i></div><div class="card"><b>Selected text</b><code>eyJ1c2VyIjoiYWRhIn0=</code></div></div>
        <div class="step"><div class="num"><span>02</span><i></i></div><div class="card"><b>base64 decode</b><code>{"user":"ada"}</code></div></div>
        <div class="step"><div class="num"><span>03</span></div><div class="card"><b>json pretty</b><code>{<br>&nbsp;&nbsp;"user": "ada"<br>}</code></div></div>
      </div></main>`), 1400, 560)

  const thumbs = await Promise.all(['01-decode-base64', '02-format-json', '03-change-case', '04-hash-text', '05-customize-menu', 'small-promo-440x280', 'marquee-promo-1400x560', 'store-icon-128']
    .map(async name => ({ name, url: data(await readFile(path.join(assetDir, `${name}.png`))) })))
  await exportHtml('contact-sheet', html(base(THEMES.light) + `.gallery{padding:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px}figure{margin:0;height:280px;background:var(--surface);border:1px solid var(--line);padding:12px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center}figure img{max-width:100%;max-height:230px;object-fit:contain}figcaption{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--muted);padding-top:9px}`,
    `<div class="gallery">${thumbs.map(t => `<figure><img src="${t.url}"><figcaption>${t.name}</figcaption></figure>`).join('')}</div>`), 1440, 950)
  // The contact sheet is a review aid, kept outside the upload directory.
  await writeFile(path.join(dir, 'contact-sheet.png'), await readFile(path.join(assetDir, 'contact-sheet.png')))
  await rm(path.join(assetDir, 'contact-sheet.png'))
  await writeFile(path.join(dir, 'capture-verification.json'), JSON.stringify({
    extensionVersion: JSON.parse(await readFile(path.join(extension, 'manifest.json'))).version,
    source: 'Real unpacked extension in isolated Chromium; no mocked Chrome APIs.',
    fonts: 'Instrument Sans and JetBrains Mono, the typefaces the extension names first, loaded into the captured pages.',
    examples: results, pageErrors: errors,
  }, null, 2) + '\n')
  console.log(`Created 8 upload assets and the contact sheet. ${results[0].offeredUtilities} utilities offered; ${examples.length} real outputs verified.`)
} finally {
  await context.close()
  // Only remove the temporary profile made by this script, never a user's browser profile.
  if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith('subelt-store-')) await rm(profile, { recursive: true, force: true })
}
