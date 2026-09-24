import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import satori from 'satori'
import { initWasm, Resvg } from '@resvg/resvg-wasm'

// this module runs under vite-node as ESM; `require.resolve` is the simplest
// reliable way to locate a dependency's on-disk files (fonts, the .wasm binary)
// regardless of the current working directory
const require = createRequire(import.meta.url)

const WIDTH = 1200
const HEIGHT = 630
const BRAND = 'String Utility Belt'
const SITE_HOST = 'stringutilitybelt.com'

let resvgReady: Promise<void> | null = null

/** Initializes the resvg-wasm module exactly once, from the package's own binary. */
export function ensureResvgInit(): Promise<void> {
  if (!resvgReady) {
    const wasmPath = require.resolve('@resvg/resvg-wasm/index_bg.wasm')
    resvgReady = initWasm(readFileSync(wasmPath))
  }
  return resvgReady
}

export interface OgFonts {
  regular: Buffer
  bold: Buffer
}

/** Loads the Plus Jakarta Sans weights satori needs (400 + 700, Latin). */
export function loadOgFonts(): OgFonts {
  const base = path.dirname(require.resolve('@fontsource/plus-jakarta-sans/package.json'))
  return {
    regular: readFileSync(path.join(base, 'files/plus-jakarta-sans-latin-400-normal.woff')),
    bold: readFileSync(path.join(base, 'files/plus-jakarta-sans-latin-700-normal.woff')),
  }
}

export interface OgCardOptions {
  name: string
  category?: string
  description: string
}

const truncate = (s: string, max: number): string => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s)

const sub = (codePoint: number, text: string): [string, string] => [String.fromCodePoint(codePoint), text]

/**
 * Symbols utility names/descriptions use that the Latin subset of Plus Jakarta
 * Sans has no glyph for (satori would draw a .notdef box), mapped to text it
 * can draw. `findMissingGlyphs` (and its manifest-wide test) catches new ones.
 */
const OG_SUBSTITUTES = new Map<string, string>([
  sub(0x2010, '-'), // hyphen
  sub(0x2011, '-'), // non-breaking hyphen ("UTF-8", "SHA-256")
  sub(0x2190, '<-'), // leftwards arrow
  sub(0x2192, '->'), // rightwards arrow
  sub(0x2194, '<->'), // left right arrow ("number <-> words")
  sub(0x21d2, '=>'), // rightwards double arrow
  sub(0x2260, '!='), // not equal
  sub(0x2264, '<='), // less-than or equal
  sub(0x2265, '>='), // greater-than or equal
])

/** Replaces characters the OG font cannot draw with ASCII equivalents. */
export function ogText(text: string): string {
  let out = ''
  for (const ch of text) out += OG_SUBSTITUTES.get(ch) ?? ch
  return out
}

const satoriFonts = (fonts: OgFonts) => [
  { name: 'Plus Jakarta Sans', data: fonts.regular, weight: 400 as const, style: 'normal' as const },
  { name: 'Plus Jakarta Sans', data: fonts.bold, weight: 700 as const, style: 'normal' as const },
]

/**
 * Satori calls `loadAdditionalAsset` with every run of text no loaded font
 * covers; answering with no fonts keeps the render going while recording it.
 */
const missingGlyphHook = (onMissing: (segment: string) => void) =>
  async (_languageCode: string, segment: string) => {
    onMissing(segment)
    return []
  }

/** The distinct characters in `text` that no OG font can draw (whitespace ignored). */
export async function findMissingGlyphs(text: string, fonts: OgFonts): Promise<string[]> {
  const unique = [...new Set(text)].filter(ch => ch.trim() !== '').join(' ')
  const missing = new Set<string>()
  await satori({ type: 'div', props: { style: { display: 'flex', flexWrap: 'wrap', fontFamily: 'Plus Jakarta Sans' }, children: unique } } as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: satoriFonts(fonts),
    loadAdditionalAsset: missingGlyphHook(segment => {
      for (const ch of segment) if (ch.trim() !== '') missing.add(ch)
    }),
  })
  return [...missing]
}

/** Minimal shape satori's object syntax needs — avoids depending on React's JSX types. */
interface SatoriNode {
  type: string
  props: { style?: Record<string, string | number>; children?: SatoriNode[] | SatoriNode | string }
}

/** The 1200x630 satori element tree (object syntax, no JSX) for one OG card. */
function ogTemplate({ name, category, description }: OgCardOptions): SatoriNode {
  return {
    type: 'div',
    props: {
      style: {
        width: `${WIDTH}px`,
        height: `${HEIGHT}px`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#0b1220',
        backgroundImage: 'linear-gradient(135deg, #0b1220 0%, #111827 60%, #0b1220 100%)',
        padding: '64px',
        fontFamily: 'Plus Jakarta Sans',
        color: '#f8fafc',
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'center', gap: '14px' },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    width: '32px', height: '32px', borderRadius: '10px',
                    backgroundColor: '#38bdf8', display: 'flex',
                  },
                  children: [],
                },
              },
              {
                type: 'div',
                props: {
                  style: { fontSize: '26px', fontWeight: 700, letterSpacing: '-0.01em' },
                  children: BRAND,
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: '22px' },
            children: [
              category
                ? {
                    type: 'div',
                    props: {
                      style: {
                        display: 'flex', fontSize: '18px', fontWeight: 700, color: '#38bdf8',
                        backgroundColor: 'rgba(56,189,248,0.14)', padding: '8px 20px', borderRadius: '999px',
                        letterSpacing: '0.08em', textTransform: 'uppercase', alignSelf: 'flex-start',
                      },
                      children: category,
                    },
                  }
                : { type: 'div', props: { style: { display: 'flex' }, children: [] } },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', fontSize: '68px', fontWeight: 700, lineHeight: 1.08 },
                  children: truncate(name, 60),
                },
              },
              {
                type: 'div',
                props: {
                  style: { display: 'flex', fontSize: '28px', color: '#cbd5e1', maxWidth: '980px' },
                  children: truncate(description, 140),
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { display: 'flex', fontSize: '22px', color: '#64748b' },
            children: SITE_HOST,
          },
        },
      ],
    },
  }
}

export interface RenderOgOptions {
  /** Called with any run of text no OG font can draw (it would render as boxes). */
  onMissingGlyphs?: (segment: string) => void
}

/** Renders one OG card to PNG bytes (satori → SVG, resvg-wasm → raster). */
export async function renderOgPng(opts: OgCardOptions, fonts: OgFonts, { onMissingGlyphs }: RenderOgOptions = {}): Promise<Uint8Array> {
  await ensureResvgInit()
  const card: OgCardOptions = {
    name: ogText(opts.name),
    category: opts.category === undefined ? undefined : ogText(opts.category),
    description: ogText(opts.description),
  }
  const svg = await satori(ogTemplate(card) as unknown as Parameters<typeof satori>[0], {
    width: WIDTH,
    height: HEIGHT,
    fonts: satoriFonts(fonts),
    ...(onMissingGlyphs ? { loadAdditionalAsset: missingGlyphHook(onMissingGlyphs) } : {}),
  })
  // satori already converts every glyph to a vector path, so resvg never shapes
  // text itself — skip system font discovery entirely for speed and determinism
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH }, font: { loadSystemFonts: false } })
  // free the wasm-side objects now rather than whenever GC finalizes them —
  // hundreds of renders otherwise grow the (never-shrinking) wasm heap
  try {
    const image = resvg.render()
    try {
      return image.asPng()
    } finally {
      image.free()
    }
  } finally {
    resvg.free()
  }
}

/** Tiny concurrency pool: runs `items` through `worker`, at most `limit` in flight. */
export async function runPool<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      await worker(items[i], i)
    }
  })
  await Promise.all(runners)
}
