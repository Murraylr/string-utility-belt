import { describe, it, expect } from 'vitest'
import util from './index'

describe('color_convert', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('color_convert')
    expect(util.name).toBe('color convert')
    expect(util.category).toBe('Color')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
  })

  it('parses every input notation down to the same hex', async () => {
    for (const source of [
      'red',
      'RED',
      '#f00',
      '#FF0000',
      'ff0000',
      'rgb(255, 0, 0)',
      'rgb(255 0 0)',
      'rgb(100%, 0%, 0%)',
      'hsl(0, 100%, 50%)',
      'hsl(0deg 100% 50%)',
      'hwb(0 0% 0%)'
    ]) {
      expect(await util.apply(source, { to: 'hex' })).toBe('#ff0000')
    }
  })

  it('converts to every output notation', async () => {
    const params = { to: 'hex', precision: 2 }
    expect(await util.apply('red', { ...params, to: 'hex' })).toBe('#ff0000')
    expect(await util.apply('red', { ...params, to: 'hex-alpha' })).toBe('#ff0000ff')
    expect(await util.apply('red', { ...params, to: 'rgb' })).toBe('rgb(255, 0, 0)')
    expect(await util.apply('red', { ...params, to: 'rgba' })).toBe('rgba(255, 0, 0, 1)')
    expect(await util.apply('red', { ...params, to: 'hsl' })).toBe('hsl(0, 100%, 50%)')
    expect(await util.apply('red', { ...params, to: 'hsla' })).toBe('hsla(0, 100%, 50%, 1)')
    expect(await util.apply('red', { ...params, to: 'hwb' })).toBe('hwb(0 0% 0%)')
    expect(await util.apply('red', { ...params, to: 'lab' })).toBe('lab(54.29 80.8 69.89)')
    expect(await util.apply('red', { ...params, to: 'lch' })).toBe('lch(54.29 106.84 40.86)')
    expect(await util.apply('red', { ...params, to: 'oklab' })).toBe('oklab(0.63 0.22 0.13)')
    expect(await util.apply('red', { ...params, to: 'oklch' })).toBe('oklch(0.63 0.26 29.23)')
    expect(await util.apply('red', { ...params, to: 'named' })).toBe('red')
  })

  it('converts non-primary colors through hsl and back', async () => {
    expect(await util.apply('#336699', { to: 'hsl' })).toBe('hsl(210, 50%, 40%)')
    expect(await util.apply('hsl(210, 50%, 40%)', { to: 'hex' })).toBe('#336699')
    expect(await util.apply('#336699', { to: 'hwb' })).toBe('hwb(210 20% 40%)')
    expect(await util.apply('hwb(210 20% 40%)', { to: 'hex' })).toBe('#336699')
  })

  it('round-trips the modern lab/lch/oklab/oklch notations back to hex', async () => {
    for (const to of ['lab', 'lch', 'oklab', 'oklch']) {
      const encoded = await util.apply('#4a90d9', { to, precision: 6 })
      expect(await util.apply(encoded, { to: 'hex' })).toBe('#4a90d9')
    }
  })

  // A round-trip only proves the forward and inverse matrices agree with each
  // other. These vectors were computed independently (Bradford-adapted CIE Lab
  // and Ottosson's published Oklab matrices), so a wrong conversion table is
  // caught even when it round-trips cleanly.
  it('matches independently computed lab/lch/oklab/oklch reference values', async () => {
    expect(await util.apply('#336699', { to: 'lab', precision: 4 })).toBe(
      'lab(41.5208 -4.5731 -33.4942)'
    )
    expect(await util.apply('#336699', { to: 'lch', precision: 4 })).toBe(
      'lch(41.5208 33.8049 262.2253)'
    )
    expect(await util.apply('#336699', { to: 'oklab', precision: 4 })).toBe(
      'oklab(0.4993 -0.033 -0.093)'
    )
    expect(await util.apply('#336699', { to: 'oklch', precision: 4 })).toBe(
      'oklch(0.4993 0.0987 250.4331)'
    )
  })

  it('decodes independently computed lab/lch/oklab/oklch vectors to exact hex', async () => {
    expect(await util.apply('lab(41.520824 -4.57309 -33.494195)', { to: 'hex' })).toBe('#336699')
    expect(await util.apply('lch(41.520824 33.804944 262.225262)', { to: 'hex' })).toBe('#336699')
    expect(await util.apply('lab(32.392716 38.422994 -47.691126)', { to: 'hex' })).toBe('#663399')
    // Saturated cyans/greens sit where a wrong Oklab->XYZ matrix bites hardest:
    // these three shift by a whole byte if LMS_TO_XYZ65 is even 0.001 off.
    expect(await util.apply('oklab(0.691201 -0.112819 -0.017791)', { to: 'hex' })).toBe('#20b2aa')
    expect(await util.apply('oklch(0.866806 0.206745 156.904982)', { to: 'hex' })).toBe('#00fa9a')
    expect(await util.apply('oklab(0.888606 -0.147491 -0.03603)', { to: 'hex' })).toBe('#02f9f7')
    expect(await util.apply('oklch(0.464258 0.170765 258.576093)', { to: 'hex' })).toBe('#0753b6')
  })

  it('accepts every hue unit and percentage form', async () => {
    expect(await util.apply('hsl(0.5turn 100% 50%)', { to: 'hex' })).toBe('#00ffff')
    expect(await util.apply('hsl(200grad 100% 50%)', { to: 'hex' })).toBe('#00ffff')
    expect(await util.apply('hsl(3.14159rad 100% 50%)', { to: 'hex' })).toBe('#00ffff')
    expect(await util.apply('rgb(50%, 25%, 0%)', { to: 'hex' })).toBe('#804000')
    expect(await util.apply('lab(50% 0 0)', { to: 'lab', precision: 0 })).toBe('lab(50 0 0)')
  })

  it('keeps alpha through hex-alpha, rgba and the slash notations', async () => {
    expect(await util.apply('#ff000080', { to: 'rgba' })).toBe('rgba(255, 0, 0, 0.5)')
    expect(await util.apply('rgba(255, 0, 0, 0.5)', { to: 'hex-alpha' })).toBe('#ff000080')
    expect(await util.apply('rgb(255 0 0 / 50%)', { to: 'hex-alpha' })).toBe('#ff000080')
    expect(await util.apply('#ff000080', { to: 'hwb' })).toBe('hwb(0 0% 0% / 0.5)')
    expect(await util.apply('#ff0000', { to: 'hwb' })).toBe('hwb(0 0% 0%)')
    // `hex` deliberately drops alpha; `hex-alpha` always keeps it.
    expect(await util.apply('#ff000080', { to: 'hex' })).toBe('#ff0000')
    expect(await util.apply('transparent', { to: 'hex-alpha' })).toBe('#00000000')
    expect(await util.apply('rgba(1, 2, 3, 0)', { to: 'named' })).toBe('transparent')
  })

  it('names exact matches and falls back to the nearest name', async () => {
    expect(await util.apply('#663399', { to: 'named' })).toBe('rebeccapurple')
    expect(await util.apply('#00ffff', { to: 'named' })).toBe('aqua')
    expect(await util.apply('#fe0101', { to: 'named' })).toBe('red')
  })

  it('honours precision', async () => {
    expect(await util.apply('#4a90d9', { to: 'oklch', precision: 0 })).toBe('oklch(1 0 251)')
    expect(await util.apply('#4a90d9', { to: 'oklch', precision: 4 })).toBe(
      'oklch(0.641 0.1309 251.4195)'
    )
  })

  it('processes one color per line, or the whole input at once', async () => {
    expect(await util.apply('red\nlime\n#0000ff', { to: 'hex', perLine: true })).toBe(
      '#ff0000\n#00ff00\n#0000ff'
    )
    expect(await util.apply('red\n\nlime', { to: 'hex', perLine: true })).toBe('#ff0000\n\n#00ff00')
    expect(await util.apply('  #ff0000  ', { to: 'hex', perLine: false })).toBe('#ff0000')
    expect(() => util.apply('red\nlime', { to: 'hex', perLine: false })).toThrow(/invalid color/)
  })

  it('produces a full json breakdown for "all"', async () => {
    const one = (await util.apply('rebeccapurple', { to: 'all' })) as Record<string, unknown>
    expect(one.hex).toBe('#663399')
    expect(one.named).toBe('rebeccapurple')
    expect(one.namedExact).toBe(true)
    expect(one.rgb).toBe('rgb(102, 51, 153)')
    expect(one.components).toEqual({ r: 102, g: 51, b: 153 })
    expect(one.alpha).toBe(1)

    const many = (await util.apply('red\nlime', { to: 'all', perLine: true })) as unknown as Record<
      string,
      unknown
    >[]
    expect(Array.isArray(many)).toBe(true)
    expect(many.map((entry) => entry.hex)).toEqual(['#ff0000', '#00ff00'])
  })

  it('returns empty output for empty input instead of throwing', async () => {
    expect(await util.apply('', { to: 'hex' })).toBe('')
    expect(await util.apply('   \n  ', { to: 'oklch' })).toBe('')
    expect(await util.apply('', { to: 'all' })).toEqual({})
  })

  it('throws a clear error on malformed or non-ASCII input', () => {
    expect(() => util.apply('café', { to: 'hex' })).toThrow(/invalid color: café/)
    expect(() => util.apply('#12345', { to: 'hex' })).toThrow(/invalid color/)
    expect(() => util.apply('rgb(1, 2)', { to: 'hex' })).toThrow(/invalid color/)
    expect(() => util.apply('hsl(x, 1%, 2%)', { to: 'hex' })).toThrow(/invalid color/)
    expect(() => util.apply('red', { to: 'cmyk' })).toThrow(/unknown output format: cmyk/)
  })

  it('uses sensible defaults when no params are supplied', async () => {
    expect(await util.apply('rgb(0, 128, 0)', {})).toBe('#008000')
    expect(await util.apply('green', {})).toBe('#008000')
  })
})
