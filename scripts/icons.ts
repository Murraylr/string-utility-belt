/**
 * Generates the PWA app icons (public/icons/*.png) from a vector logo, using
 * @resvg/resvg-wasm so the build has no native image dependency. Run with
 * `npx vite-node scripts/icons.ts` after touching the logo and commit the
 * resulting PNGs — they are NOT regenerated at build time.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')


/** Brand mark colour — matches `--color-primary-600` in src/index.css. */
export const LOGO_COLOR = '#5458ee'
export const LOGO_FOREGROUND = '#ffffff'

export interface IconSpec {
  file: string
  size: number
  /** Maskable icons must be full-bleed (no baked-in rounding) with content kept inside the safe zone. */
  maskable: boolean
  /** No baked-in rounding: iOS masks the apple-touch-icon itself and fills transparent corners black. */
  fullBleed?: boolean
}

export const ICON_SPECS: IconSpec[] = [
  { file: 'icon-192.png', size: 192, maskable: false },
  { file: 'icon-512.png', size: 512, maskable: false },
  { file: 'icon-maskable-512.png', size: 512, maskable: true },
  { file: 'apple-touch-icon.png', size: 180, maskable: false, fullBleed: true },
]

/**
 * The mark is a stroked "S" built from two arcs rather than a font glyph, so
 * rendering is identical on every machine (no system-font lookup inside the
 * wasm renderer). `maskable` drops the corner rounding (the OS applies its
 * own mask) and shrinks the glyph so it stays inside the ~80% safe zone.
 */
export function buildIconSvg({ maskable, fullBleed }: Pick<IconSpec, 'maskable' | 'fullBleed'>): string {
  const rx = maskable || fullBleed ? 0 : 112
  const strokeWidth = maskable ? 40 : 48
  // upper arc sweeps anticlockwise (bulges left), lower arc clockwise (bulges right) — an S, not its mirror
  const glyph = maskable
    ? 'M256 146 A62 62 0 1 0 256 270 A62 62 0 1 1 256 394'
    : 'M256 108 A72 72 0 1 0 256 252 A72 72 0 1 1 256 396'
  return `<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="${rx}" fill="${LOGO_COLOR}"/>
  <path d="${glyph}" fill="none" stroke="${LOGO_FOREGROUND}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
</svg>`
}

let wasmInit: Promise<typeof import('@resvg/resvg-wasm')> | undefined

/** Lazily initializes the resvg wasm module once, cached across calls. */
async function getResvg() {
  if (!wasmInit) {
    wasmInit = (async () => {
      const resvg = await import('@resvg/resvg-wasm')
      const wasmPath = path.join(ROOT, 'node_modules/@resvg/resvg-wasm/index_bg.wasm')
      await resvg.initWasm(await readFile(wasmPath))
      return resvg
    })()
  }
  return wasmInit
}

async function rasterize(spec: IconSpec) {
  const { Resvg } = await getResvg()
  return new Resvg(buildIconSvg(spec), { fitTo: { mode: 'width', value: spec.size } }).render()
}

/** Renders one icon spec to a PNG buffer. */
export async function renderIconPng(spec: IconSpec): Promise<Uint8Array> {
  return (await rasterize(spec)).asPng()
}

/** Renders one icon spec to raw RGBA pixels (row-major, 4 bytes per pixel). */
export async function renderIconPixels(spec: IconSpec): Promise<{ width: number; height: number; pixels: Uint8Array }> {
  const image = await rasterize(spec)
  return { width: image.width, height: image.height, pixels: image.pixels }
}

/** Renders every spec and writes it under `outDir` (default `public/icons`). Returns the written paths. */
export async function generateIcons(outDir = path.join(ROOT, 'public/icons')): Promise<string[]> {
  await mkdir(outDir, { recursive: true })
  const written: string[] = []
  for (const spec of ICON_SPECS) {
    const png = await renderIconPng(spec)
    const dest = path.join(outDir, spec.file)
    await writeFile(dest, png)
    written.push(dest)
  }
  return written
}

// CLI entry point: `npx vite-node scripts/icons.ts` (guarded so importing the
// pure functions from a test — which also loads this module — doesn't
// trigger a wasm init + file write as a side effect).
if (!process.env.VITEST) {
  generateIcons().then(
    (written) => console.log(`[icons] wrote ${written.length} icon(s):\n` + written.map((w) => `  ${w}`).join('\n')),
    (e) => { console.error(`[icons] ${e?.message ?? e}`); process.exit(1) },
  )
}
