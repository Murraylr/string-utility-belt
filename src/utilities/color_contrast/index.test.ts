import { describe, it, expect } from 'vitest'
import util from './index'

type Report = {
  foreground: string
  background: string
  foregroundInput: string
  backgroundInput: string
  composited: boolean
  ratio: number
  foregroundLuminance: number
  backgroundLuminance: number
  AA: { normalText: boolean; largeText: boolean; ui: boolean }
  AAA: { normalText: boolean; largeText: boolean; ui: boolean }
  thresholds: Record<string, Record<string, number>>
  summary: string
}

const run = async (input: string, params: Record<string, unknown> = {}) =>
  (await util.apply(input, params)) as unknown as Report

describe('color_contrast', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('color_contrast')
    expect(util.name).toBe('color contrast')
    expect(util.category).toBe('Color')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
  })

  it('declares foreground/background as color params with their original defaults', () => {
    expect(util.params.foreground.kind).toBe('color')
    expect(util.params.foreground.default).toBe('')
    expect(util.params.background.kind).toBe('color')
    expect(util.params.background.default).toBe('#ffffff')
  })

  it('still accepts any CSS color notation for foreground/background, not just hex', async () => {
    // The `color` param kind is a UI hint (native color pickers), not a runtime
    // restriction — apply() must keep accepting named colors, rgb(), etc.
    const onNavy = await run('white', { background: 'navy' })
    expect(onNavy.background).toBe('#000080')
    const report = await run('', { foreground: 'red', background: 'white' })
    expect(report.foreground).toBe('#ff0000')
  })

  it('scores black on white as the 21:1 maximum', async () => {
    const report = await run('#000000 #ffffff')
    expect(report.ratio).toBe(21)
    expect(report.foreground).toBe('#000000')
    expect(report.background).toBe('#ffffff')
    expect(report.foregroundLuminance).toBe(0)
    expect(report.backgroundLuminance).toBe(1)
    expect(report.AA).toEqual({ normalText: true, largeText: true, ui: true })
    expect(report.AAA).toEqual({ normalText: true, largeText: true, ui: true })
    expect(report.summary).toBe('21:1 — passes AAA for normal and large text')
  })

  it('reads two colors from the input, whitespace or comma separated', async () => {
    expect((await run('white, black')).ratio).toBe(21)
    expect((await run('#fff\n#000')).ratio).toBe(21)
    expect((await run('#000000 on #ffffff')).ratio).toBe(21)
    expect((await run('rgb(0 0 0), hsl(0 0% 100%)')).ratio).toBe(21)
  })

  it('falls back to the background param when the input holds one color', async () => {
    const report = await run('white')
    expect(report.foreground).toBe('#ffffff')
    expect(report.background).toBe('#ffffff')
    expect(report.ratio).toBe(1)
    expect(report.AA).toEqual({ normalText: false, largeText: false, ui: false })
    expect(report.summary).toBe('1:1 — fails every WCAG minimum')

    const onNavy = await run('white', { background: 'navy' })
    expect(onNavy.background).toBe('#000080')
    expect(onNavy.ratio).toBeGreaterThan(7)
  })

  it('prefers the foreground param over anything in the input', async () => {
    const report = await run('#ffffff #ffffff', { foreground: '#767676', background: '#ffffff' })
    expect(report.foregroundInput).toBe('#767676')
    expect(report.backgroundInput).toBe('#ffffff')
    // The canonical "smallest colour that still passes AA for body text".
    expect(report.ratio).toBe(4.54)
    expect(report.AA.normalText).toBe(true)
    expect(report.AAA.normalText).toBe(false)
  })

  it('grades large text and UI separately from body text', async () => {
    const report = await run('red')
    expect(report.ratio).toBe(4)
    expect(report.AA).toEqual({ normalText: false, largeText: true, ui: true })
    expect(report.AAA).toEqual({ normalText: false, largeText: false, ui: true })
    expect(report.summary).toBe('4:1 — passes AA for large text and UI only')
    expect(report.thresholds.AA.normalText).toBe(4.5)
    expect(report.thresholds.AAA.normalText).toBe(7)
  })

  it('flattens translucent colors onto the background before measuring', async () => {
    const report = await run('rgba(0, 0, 0, 0.5)', { background: '#ffffff' })
    expect(report.composited).toBe(true)
    expect(report.foreground).toBe('#808080')
    expect(report.ratio).toBe(3.98)

    const opaque = await run('#000000', { background: '#ffffff' })
    expect(opaque.composited).toBe(false)
  })

  it('understands the modern css color functions', async () => {
    const report = await run('oklch(0.63 0.26 29.23)', { background: 'white' })
    expect(report.foreground).toBe('#ff0000')
    expect(report.ratio).toBe(4)

    const lab = await run('lab(54.29 80.8 69.89)', { background: 'white' })
    expect(lab.foreground).toBe('#ff0000')

    // Independently computed vectors (Bradford-adapted CIE Lab, Ottosson Oklab).
    // Red clamps at the gamut edge and would hide a bad conversion matrix;
    // these in-gamut colors would not.
    expect((await run('oklab(0.691201 -0.112819 -0.017791)')).foreground).toBe('#20b2aa')
    expect((await run('oklch(0.866806 0.206745 156.904982)')).foreground).toBe('#00fa9a')
    expect((await run('lab(41.520824 -4.57309 -33.494195)')).foreground).toBe('#336699')
  })

  it('grades the exact ratio, not the display-rounded one', async () => {
    // #0078d7 on white is 4.4989:1 — it displays as "4.5" but does not meet the
    // 4.5:1 AA minimum for body text.
    const body = await run('', { foreground: '#0078d7', background: '#ffffff' })
    expect(body.ratio).toBe(4.5)
    expect(body.AA.normalText).toBe(false)
    expect(body.AA.largeText).toBe(true)
    expect(body.summary).toBe('4.5:1 — passes AA for large text and UI only')

    // #0099ff is 2.9998:1 — below the 3:1 non-text minimum.
    const ui = await run('', { foreground: '#0099ff', background: '#ffffff' })
    expect(ui.ratio).toBe(3)
    expect(ui.AA.ui).toBe(false)

    // ...while a genuine 4.5:1 or better still passes.
    expect((await run('', { foreground: '#767676' })).AA.normalText).toBe(true)
  })

  it('clamps out-of-gamut colors before compositing', async () => {
    // oklch(0.9 0.4 30) is far outside sRGB; contrast is defined on what the
    // display actually shows, so it must clamp to #ff0000 before the 50% blend.
    const report = await run('oklch(0.9 0.4 30 / 0.5)', { background: '#000000' })
    expect(report.foreground).toBe('#800000')
    expect(report.composited).toBe(true)
  })

  it('hands back a private thresholds table, not the shared one', async () => {
    const first = await run('red')
    first.thresholds.AA.normalText = 999
    expect((await run('red')).thresholds.AA.normalText).toBe(4.5)
  })

  it('returns an empty report for empty input instead of throwing', async () => {
    expect(await util.apply('', {})).toEqual({})
    expect(await util.apply('   \n ', {})).toEqual({})
  })

  it('throws a clear error when nothing in the input is a color', () => {
    expect(() => util.apply('café au lait', {})).toThrow(/no color found/)
    expect(() => util.apply('', { foreground: '#gggggg' })).toThrow(/invalid color/)
    expect(() => util.apply('', { foreground: 'red', background: 'nope' })).toThrow(/invalid color/)
  })
})
