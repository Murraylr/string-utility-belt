// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ICON_SPECS, buildIconSvg, generateIcons, renderIconPng, renderIconPixels, LOGO_COLOR } from './icons'

const ROOT = path.resolve(__dirname, '..')

/** Width/height from a PNG's IHDR chunk. */
function pngSize(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('ICON_SPECS', () => {
  it('covers the manifest requirement: 192 + 512 "any", a 512 maskable, and a 180 apple-touch-icon', () => {
    const summary = ICON_SPECS.map(({ file, size, maskable }) => ({ file, size, maskable }))
    expect(summary).toEqual(expect.arrayContaining([
      { file: 'icon-192.png', size: 192, maskable: false },
      { file: 'icon-512.png', size: 512, maskable: false },
      { file: 'icon-maskable-512.png', size: 512, maskable: true },
      { file: 'apple-touch-icon.png', size: 180, maskable: false },
    ]))
  })
})

describe('buildIconSvg', () => {
  it('is a font-independent vector mark using the brand colour', () => {
    const svg = buildIconSvg({ maskable: false })
    expect(svg).toContain('<svg')
    expect(svg).toContain(LOGO_COLOR)
    expect(svg).not.toMatch(/<text|font-family/)
  })

  it('rounds the corners for the "any" purpose icon', () => {
    expect(buildIconSvg({ maskable: false })).toMatch(/rx="[1-9]\d*"/)
  })

  it('is full-bleed (no corner rounding) when the OS applies its own mask: maskable and apple-touch-icon', () => {
    expect(buildIconSvg({ maskable: true })).toMatch(/rx="0"/)
    expect(buildIconSvg({ maskable: false, fullBleed: true })).toMatch(/rx="0"/)
  })
})

describe('the rendered mark', () => {
  /** x positions of the foreground (white) pixels in one row. */
  function whiteColumns({ width, pixels }: { width: number; pixels: Uint8Array }, y: number) {
    const xs: number[] = []
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (pixels[i] > 200 && pixels[i + 1] > 200 && pixels[i + 2] > 200) xs.push(x)
    }
    return xs
  }

  // An "S": the upper bowl bulges LEFT (opening right) and the lower bowl bulges RIGHT.
  // A mirrored glyph reads as a "2"/"ƨ" on every home screen.
  it.each(ICON_SPECS)('reads as an S, not a mirrored S ($file)', async (spec) => {
    const image = await renderIconPixels(spec)
    const mid = image.width / 2
    const upper = whiteColumns(image, Math.round(image.height * 0.35))
    const lower = whiteColumns(image, Math.round(image.height * 0.65))
    expect(upper.length).toBeGreaterThan(0)
    expect(lower.length).toBeGreaterThan(0)
    expect(Math.max(...upper)).toBeLessThan(mid)
    expect(Math.min(...lower)).toBeGreaterThan(mid)
  }, 30_000)
})

describe('generateIcons', () => {
  it('renders every spec to a PNG of the declared size', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'subelt-icons-'))
    try {
      const written = await generateIcons(dir)
      expect(written).toHaveLength(ICON_SPECS.length)
      for (const spec of ICON_SPECS) {
        const bytes = fs.readFileSync(path.join(dir, spec.file))
        expect([...bytes.subarray(0, 8)]).toEqual(PNG_MAGIC)
        expect(pngSize(bytes)).toEqual({ width: spec.size, height: spec.size })
      }
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }, 30_000)
})

describe('committed icons (public/icons)', () => {
  it('are up to date with the generator — run `npx vite-node scripts/icons.ts` after changing the logo', async () => {
    for (const spec of ICON_SPECS) {
      const committed = fs.readFileSync(path.join(ROOT, 'public/icons', spec.file))
      expect(Buffer.from(await renderIconPng(spec)).equals(committed), spec.file).toBe(true)
    }
  }, 30_000)

  it('match the sizes and purposes public/manifest.webmanifest declares, and index.html links them', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/manifest.webmanifest'), 'utf8'))
    const purposes = new Set<string>()
    for (const icon of manifest.icons) {
      const bytes = fs.readFileSync(path.join(ROOT, 'public', icon.src))
      const [w, h] = String(icon.sizes).split('x').map(Number)
      expect(pngSize(bytes), icon.src).toEqual({ width: w, height: h })
      purposes.add(icon.purpose ?? 'any')
    }
    expect([...purposes].sort()).toEqual(['any', 'maskable'])

    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    expect(html).toMatch(/<link rel="manifest" href="\/manifest\.webmanifest">/)
    expect(html).toMatch(/<link rel="apple-touch-icon" href="\/icons\/apple-touch-icon\.png">/)
  })
})
