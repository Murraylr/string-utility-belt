// Rebuild first: node node_modules/vite/bin/vite.js build --config packages/extension/vite.config.ts
// Then: node packages/extension/store-listing/generate.mjs
// Uses a temporary Chromium profile, the real unpacked extension, and local fonts.
import { chromium } from '@playwright/test'
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
// Reuse the established S logo from the app, rather than the old blank-square extension placeholder.
const icon = data(await readFile(path.join(root, 'public/icons/icon-512.png')))
const font = data(await readFile(path.join(root, 'node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-600-normal.woff2')), 'font/woff2')
const bold = data(await readFile(path.join(root, 'node_modules/@fontsource/plus-jakarta-sans/files/plus-jakarta-sans-latin-800-normal.woff2')), 'font/woff2')
const profile = await mkdtemp(path.join(tmpdir(), 'subelt-store-'))
const extension = path.join(root, 'packages/extension/dist')
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
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
  const examples = [
    { file: '01-decode-base64', utility: 'base64_decode', input: 'SGVsbG8sIGRldmVsb3BlciE=', expected: 'Hello, developer!', kicker: 'DECODE & ENCODE', title: 'Decode without<br>the detour.', text: 'Turn encoded strings into readable text<br>right from your toolbar.', tags: ['Base64', 'URL encoding', 'JWT decode'], note: 'Also available from the right-click menu.', color: '#bbb6ff' },
    { file: '02-format-json', utility: 'json_pretty', input: '{"name":"Ada","role":"developer","active":true}', expected: '{\n  "name": "Ada",\n  "role": "developer",\n  "active": true\n}', outputHeight: 116, kicker: 'FORMAT & INSPECT', title: 'Make JSON<br>readable.', text: 'Pretty-print a compact payload.<br>Choose the indentation. Copy the result.', tags: ['JSON formatting', 'Adjustable indent'], note: 'Real input. Immediate output.', color: '#a8e7d2' },
    { file: '03-change-case', utility: 'case', input: 'make every word count', expected: 'Make Every Word Count', param: 'title', kicker: 'EVERYDAY TEXT TOOLS', title: 'Get text<br>into shape.', text: 'Switch case, trim whitespace, and clean<br>up text with a utility for the job.', tags: ['Uppercase', 'Lowercase', 'Title case'], note: 'Use the popup to customize supported settings.', color: '#ffc7a8' },
    { file: '04-hash-text', utility: 'hash', input: 'hello', expected: createHash('sha256').update('hello').digest('hex'), kicker: 'DEVELOPER ESSENTIALS', title: 'A hash,<br>in a few clicks.', text: 'Choose an algorithm and generate<br>a digest locally in your browser.', tags: ['SHA-256', 'SHA-384', 'SHA-512'], note: 'Copy the output and keep moving.', color: '#bdd5ff' },
  ]
  const captures = []
  for (const ex of examples) {
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    await page.locator('#utility option').first().waitFor({ state: 'attached' })
    const count = await page.locator('#utility option').count()
    await page.locator('#utility').selectOption(ex.utility)
    if (ex.param) await page.locator('#params select').selectOption(ex.param)
    await page.locator('#input').fill(ex.input)
    await page.locator('#run').click()
    await page.waitForFunction(() => document.querySelector('#status').textContent === 'Done.')
    const output = await page.locator('#output').inputValue()
    if (output !== ex.expected) throw new Error(`Unexpected output for ${ex.utility}: ${output}`)
    // Textarea resizing is a native part of the popup. Give multi-line JSON enough room.
    if (ex.outputHeight) await page.locator('#output').evaluate((el, h) => { el.style.height = `${h}px` }, ex.outputHeight)
    await page.locator('#utility').focus()
    await page.locator('#utility').blur()
    const raw = await page.locator('body').screenshot({ path: path.join(sourceDir, `${ex.file}-capture.png`) })
    captures.push({ ...ex, raw: data(raw), count, ratio: raw.readUInt32BE(16) / raw.readUInt32BE(20) })
    results.push({ example: ex.utility, input: ex.input, output, offeredUtilities: count })
  }
  await page.goto(`chrome-extension://${extensionId}/options.html`)
  await page.locator('#search').fill('base64_')
  await page.locator('input[value="base64_decode"]').check()
  await page.locator('input[value="base64_encode"]').check()
  await page.locator('#save').click()
  await page.waitForFunction(() => document.querySelector('#status').textContent === 'Saved.')
  await page.locator('#save').blur()
  const optionsRaw = await page.locator('body').screenshot({ path: path.join(sourceDir, '05-customize-menu-capture.png') })
  captures.push({ file: '05-customize-menu', raw: data(optionsRaw), ratio: optionsRaw.readUInt32BE(16) / optionsRaw.readUInt32BE(20), options: true, kicker: 'A MENU THAT FITS YOU', title: 'Your menu.<br>Your tools.', text: 'Search the utility library and choose<br>what appears when you right-click.', tags: ['Search', 'Select', 'Save'], note: 'Start with ten useful defaults. Make it your own.', color: '#cfb9ff' })
  if (errors.length) throw new Error(errors.join('\n'))

  // Compose the verified captures into full-bleed listing artwork.
  const render = await context.newPage()
  const css = `@font-face{font-family:Jakarta;src:url('${font}');font-weight:600}@font-face{font-family:Jakarta;src:url('${bold}');font-weight:800}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}body{font-family:Jakarta,sans-serif;color:#fff;background:#13152c} .canvas{width:100%;height:100%;position:relative;overflow:hidden;background:radial-gradient(ellipse at 96% 14%,#35316a 0%,transparent 62%),#13152c}.grid{position:absolute;inset:0;background-image:linear-gradient(#ffffff05 1px,transparent 1px),linear-gradient(90deg,#ffffff05 1px,transparent 1px);background-size:40px 40px}.brand{position:absolute;top:44px;left:54px;display:flex;align-items:center;gap:15px;font-size:19px;letter-spacing:-.5px}.brand img{width:40px;height:40px;border-radius:8px}.copy{position:absolute;left:58px;top:202px}.kicker{font-size:13px;font-weight:800;letter-spacing:2.8px;color:var(--accent)}h1{font-size:61px;line-height:1.12;letter-spacing:-3.4px;margin:22px 0 24px;font-weight:800}p{font-size:19px;line-height:1.7;color:#c0c2d9;margin:0}.tags{display:flex;gap:9px;margin-top:32px}.tags span{font-size:12px;border:1px solid #51516e;border-radius:20px;padding:9px 13px;color:#e5e4f6}.note{position:absolute;left:58px;bottom:91px;font-size:13px;color:#acafc9}.foot{position:absolute;bottom:34px;left:58px;right:54px;display:flex;justify-content:space-between;font-size:10px;letter-spacing:2px;color:#8e91ad}.shot{position:absolute;left:659px;top:138px;width:510px;border-radius:13px;overflow:hidden;box-shadow:0 32px 100px #0008;border:1px solid #ffffff30;background:white}.shot img{display:block;width:100%}.shot-label{position:absolute;left:659px;top:108px;font-size:10px;letter-spacing:2px;color:#acaeca}.orb{position:absolute;width:660px;height:660px;right:-146px;top:56px;border:1px solid #aaa1ff22;border-radius:50%}.orb:after{content:'';position:absolute;inset:48px;border:1px solid #aaa1ff15;border-radius:50%}`
  const html = (body, extra = '') => `<!doctype html><html><head><meta charset="utf-8"><style>${css}${extra}</style></head><body>${body}</body></html>`
  async function exportHtml(name, markup, width, height, transparent = false) {
    await writeFile(path.join(sourceDir, `${name}.html`), markup)
    await render.setViewportSize({ width, height })
    await render.setContent(markup)
    await render.evaluate(() => document.fonts.ready)
    // CSS viewport is exact; capture at CSS scale to get upload dimensions, not retina dimensions.
    await render.screenshot({ path: path.join(assetDir, `${name}.png`), scale: 'css', omitBackground: transparent })
  }
  for (let i = 0; i < captures.length; i++) {
    const c = captures[i]
    const shotWidth = Math.min(c.options ? 604 : 510, 590 * c.ratio)
    const shotLeft = 918 - shotWidth / 2
    const markup = html(`<main class="canvas" style="--accent:${c.color}"><div class="grid"></div><div class="orb"></div><div class="brand"><img src="${icon}">String Utility Belt</div><div class="copy"><div class="kicker">${c.kicker}</div><h1>${c.title}</h1><p>${c.text}</p><div class="tags">${c.tags.map(t => `<span>${t}</span>`).join('')}</div></div><div class="shot-label">${c.options ? 'EXTENSION OPTIONS' : 'TOOLBAR POPUP'}</div><div class="shot"><img src="${c.raw}"></div><div class="note">${c.note}</div><div class="foot"><span>STRING UTILITY BELT / CHROME EXTENSION</span><span>0${i + 1} / 05</span></div></main>`, c.options ? '.shot{left:622px;top:165px;width:604px}.shot-label{left:622px;top:133px}' : '')
    const fitted = markup.replace('</style>', `.shot{left:${shotLeft}px;top:138px;width:${shotWidth}px}.shot-label{left:${shotLeft}px;top:108px}</style>`)
    await exportHtml(c.file, fitted, 1280, 800)
  }
  // Use the established S mark, normalized to the store's square icon safe area.
  await exportHtml('store-icon-128', html(`<img src="${icon}" style="position:absolute;left:16px;top:16px;width:96px;height:96px">`, 'html,body{background:transparent}'), 128, 128, true)
  // Keep the toolbar/package icons consistent with the corrected store artwork.
  for (const size of [16, 32, 48, 128]) {
    const padding = size === 128 ? 16 : 0
    await render.setViewportSize({ width: size, height: size })
    await render.setContent(html(`<img src="${icon}" style="position:absolute;left:${padding}px;top:${padding}px;width:${size - 2 * padding}px;height:${size - 2 * padding}px">`, 'html,body{background:transparent}'))
    await render.screenshot({ path: path.join(root, `packages/extension/icons/icon${size}.png`), scale: 'css', omitBackground: true })
  }

  const promoCss = `.canvas{background:radial-gradient(ellipse at 95% 0%,#8571ff 0%,transparent 68%),linear-gradient(125deg,#30208f,#4f46e5)}.promo-brand{position:absolute;left:30px;top:28px;display:flex;align-items:center;gap:18px}.promo-brand img{width:58px;height:58px;border:1px solid #ffffff35;border-radius:12px}.promo-brand h2{font-size:28px;letter-spacing:-1px;line-height:1.12;margin:0;font-weight:800}.flow{position:absolute;left:30px;right:30px;top:135px;display:flex;align-items:center;gap:14px}.code{font-family:ui-monospace,Consolas,monospace;font-size:32px;padding:17px 22px;border:1px solid #ffffff35;background:#ffffff10;border-radius:14px;box-shadow:0 18px 36px #21107040}.code.out{color:#191449;background:#dcfff1;border-color:#dcfff1}.arrow{font-size:25px;color:#d7d1ff}.promo-note{position:absolute;bottom:23px;left:32px;font-size:11px;letter-spacing:2px;color:#e1dcff}.big-ring{position:absolute;right:-100px;top:-140px;width:550px;height:550px;border:1px solid #ffffff16;border-radius:50%}`
  await exportHtml('small-promo-440x280', html(`<main class="canvas"><div class="big-ring"></div><div class="promo-brand"><img src="${icon}"><h2>String<br>Utility Belt</h2></div><div class="flow"><div class="code">aB cD</div><span class="arrow">→</span><div class="code out">Ab Cd</div></div><div class="promo-note">TEXT TOOLS, WITHIN REACH.</div></main>`, promoCss), 440, 280)
  await exportHtml('marquee-promo-1400x560', html(`<main class="canvas"><div class="grid"></div><div class="big-ring"></div><div class="promo-brand"><img src="${icon}"><h2>String<br>Utility Belt</h2></div><div class="marquee-line">Text tools,<br>within reach.</div><div class="graphic"><div class="mini">aGVsbG8=</div><div class="wire"></div><div class="center"><img src="${icon}"></div><div class="wire second"></div><div class="mini output">hello<span>✓</span></div><div class="chip one">{ }</div><div class="chip two">Aa</div><div class="chip three">#</div></div><div class="promo-note">DECODE · FORMAT · TRANSFORM</div></main>`, promoCss + `.promo-brand{left:68px;top:59px}.promo-brand img{width:70px;height:70px}.promo-brand h2{font-size:31px}.marquee-line{position:absolute;left:68px;top:187px;font-size:67px;line-height:1.12;letter-spacing:-3px;font-weight:800}.promo-note{left:72px;bottom:65px;font-size:13px;letter-spacing:3px}.big-ring{width:880px;height:880px;right:-55px;top:-169px}.graphic{position:absolute;left:635px;top:100px;width:700px;height:380px}.mini{position:absolute;top:80px;left:0;background:#20195a;border:1px solid #b5a6ff88;padding:24px 30px;border-radius:18px;font:30px ui-monospace,Consolas,monospace;box-shadow:0 20px 44px #20115950}.center{position:absolute;left:265px;top:63px;width:130px;height:130px;padding:15px;border:1px solid #ffffff70;background:#ffffff17;border-radius:28px;transform:rotate(-8deg);box-shadow:0 20px 40px #21134a55}.center img{width:100%;border-radius:16px}.wire{position:absolute;left:208px;top:126px;width:59px;height:2px;background:#c3b6ff}.wire.second{left:394px;width:59px}.mini.output{left:451px;background:#dcfff1;color:#23184d;top:80px}.mini.output span{font-size:20px;margin-left:25px;color:#408972}.chip{position:absolute;border:1px solid #ffffff45;border-radius:16px;padding:13px 21px;font:28px ui-monospace,Consolas,monospace;background:#ffffff15}.one{top:243px;left:170px;transform:rotate(-10deg)}.two{top:256px;left:315px;transform:rotate(8deg)}.three{top:231px;left:463px;transform:rotate(-8deg)}`), 1400, 560)
  const thumbs = await Promise.all(['01-decode-base64','02-format-json','03-change-case','04-hash-text','05-customize-menu','small-promo-440x280','marquee-promo-1400x560','store-icon-128'].map(async name => ({ name, url: data(await readFile(path.join(assetDir, `${name}.png`))) })))
  await exportHtml('contact-sheet', html(`<div class="gallery">${thumbs.map(t => `<figure><img src="${t.url}"><figcaption>${t.name}</figcaption></figure>`).join('')}</div>`, 'body{background:#eef0f7}.gallery{padding:24px;display:grid;grid-template-columns:repeat(3,1fr);gap:22px}figure{margin:0;height:280px;background:white;padding:12px;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center}figure img{max-width:100%;max-height:230px;object-fit:contain}figcaption{font-size:12px;color:#33395a;padding-top:9px}'), 1440, 950)
  // The contact sheet is a review aid, kept outside the upload directory.
  await writeFile(path.join(dir, 'contact-sheet.png'), await readFile(path.join(assetDir, 'contact-sheet.png')))
  await rm(path.join(assetDir, 'contact-sheet.png'))
  await writeFile(path.join(dir, 'capture-verification.json'), JSON.stringify({ extensionVersion: JSON.parse(await readFile(path.join(extension, 'manifest.json'))).version, source: 'Real unpacked extension in isolated Chromium; no mocked Chrome APIs.', examples: results, pageErrors: errors }, null, 2) + '\n')
  console.log(`Created 8 upload assets and contact sheet. ${results[0].offeredUtilities} utilities offered; ${results.length} real outputs verified.`)
} finally {
  await context.close()
  // Only remove the temporary profile made by this script, never a user's browser profile.
  if (path.dirname(profile) === path.resolve(tmpdir()) && path.basename(profile).startsWith('subelt-store-')) await rm(profile, { recursive: true, force: true })
}
