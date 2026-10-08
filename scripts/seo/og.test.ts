import { describe, it, expect } from 'vitest'
import { loadOgFonts, renderOgPng, runPool, ogText, findMissingGlyphs } from './og'
import { MANIFEST } from '../../src/utilities/_generated/manifest'

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

describe('renderOgPng', () => {
  it('renders a valid PNG for one utility card', async () => {
    const fonts = loadOgFonts()
    const png = await renderOgPng({ name: 'trim', category: 'String Ops', description: 'Removes leading and trailing whitespace.' }, fonts)
    expect(Array.from(png.slice(0, 8))).toEqual(PNG_SIGNATURE)
    expect(png.length).toBeGreaterThan(1000)
  }, 30000)

  it('renders the site default card without a category', async () => {
    const fonts = loadOgFonts()
    const png = await renderOgPng({ name: 'String Utility Belt', description: 'Chain string transformations into visual pipelines.' }, fonts)
    expect(Array.from(png.slice(0, 8))).toEqual(PNG_SIGNATURE)
  }, 30000)
})

describe('runPool', () => {
  it('processes every item exactly once, never exceeding the concurrency limit', async () => {
    const items = Array.from({ length: 20 }, (_, i) => i)
    let inFlight = 0
    let maxInFlight = 0
    const seen: number[] = []
    await runPool(items, 3, async item => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise(r => setTimeout(r, 1))
      seen.push(item)
      inFlight--
    })
    expect(seen.sort((a, b) => a - b)).toEqual(items)
    expect(maxInFlight).toBeLessThanOrEqual(3)
  })

  it('handles an empty list', async () => {
    await expect(runPool([], 4, async () => {})).resolves.toBeUndefined()
  })
})

describe('OG glyph coverage (symbols the Latin subsets lack are mapped to ASCII)', () => {
  it('ogText maps symbols the font lacks to ASCII equivalents', () => {
    expect(ogText('number ↔ words')).toBe('number <-> words')
    expect(ogText('1 → 1st, 2 ← 3')).toBe('1 -> 1st, 2 <- 3')
    expect(ogText('UTF‑8 and SHA‑256')).toBe('UTF-8 and SHA-256')
    expect(ogText('a ≠ b ≤ c ≥ d')).toBe('a != b <= c >= d')
    expect(ogText('plain — text… “quoted”')).toBe('plain — text… “quoted”')
  })

  it('reports characters no loaded font can draw instead of silently rendering tofu', async () => {
    const fonts = loadOgFonts()
    const missing: string[] = []
    await renderOgPng({ name: 'a ∑ b', description: 'x' }, fonts, { onMissingGlyphs: s => missing.push(s) })
    expect(missing.join('')).toContain('∑')
  }, 30000)

  it('maps before rendering, so a mapped symbol is not reported', async () => {
    const fonts = loadOgFonts()
    const missing: string[] = []
    await renderOgPng({ name: 'tabs ↔ spaces', category: 'Lines', description: '1 → 1st in UTF‑8' }, fonts, { onMissingGlyphs: s => missing.push(s) })
    expect(missing).toEqual([])
  }, 30000)

  it('every character any utility card will draw is covered by the OG font', async () => {
    const fonts = loadOgFonts()
    // the detector itself works (so an empty result below is meaningful)
    expect(await findMissingGlyphs('number ↔ words', fonts)).toEqual(['↔'])
    const text = MANIFEST.map(m => ogText(`${m.name} ${m.category} ${m.description}`)).join(' ')
    const missing = await findMissingGlyphs(text, fonts)
    expect(missing, `add a mapping in ogText() for: ${missing.join(' ')}`).toEqual([])
  }, 60000)
})
