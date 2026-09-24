import { describe, it, expect } from 'vitest'
import util from './index'

const run = (input: string, params: Record<string, unknown> = {}) =>
  util.apply(input, params) as Promise<string> | string

const FANCY = '“Hello” — it’s a ‘test’…'

describe('smart_quotes', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('smart_quotes')
    expect(util.name).toBe('smart quotes')
    expect(util.category).toBe('Formatting')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['direction', 'quotes', 'dashes', 'ellipsis', 'locale'])
  })

  it('straightens quotes, dashes and ellipses by default', async () => {
    expect(await run(FANCY)).toBe('"Hello" --- it\'s a \'test\'...')
    // em dash ⇒ ---, en dash ⇒ --, so to-smart can rebuild them exactly
    expect(await run('en – dash')).toBe('en -- dash')
    expect(await run('em — dash')).toBe('em --- dash')
    expect(await run('minus 5 − 3 and figure ‒')).toBe('minus 5 - 3 and figure -')
  })

  it('returns empty string for empty input', async () => {
    expect(await run('')).toBe('')
    expect(await run('', { direction: 'to-smart' })).toBe('')
  })

  it('honours the quotes, dashes and ellipsis toggles', async () => {
    expect(await run(FANCY, { quotes: false })).toBe('“Hello” --- it’s a ‘test’...')
    expect(await run(FANCY, { dashes: false })).toBe('"Hello" — it\'s a \'test\'...')
    expect(await run(FANCY, { ellipsis: false })).toBe('"Hello" --- it\'s a \'test\'…')
    expect(await run('a -- b ...', { direction: 'to-smart', dashes: false, ellipsis: false }))
      .toBe('a -- b ...')
  })

  it('curls quotes, apostrophes and ellipses going to-smart', async () => {
    expect(await run('He said "hello", it\'s a \'test\'...', { direction: 'to-smart' }))
      .toBe('He said “hello”, it’s a ‘test’…')
    expect(await run('\'90s music', { direction: 'to-smart' })).toBe('’90s music')
    expect(await run('the dogs\' bones', { direction: 'to-smart' })).toBe('the dogs’ bones')
  })

  it('converts double and triple hyphens to en and em dashes', async () => {
    expect(await run('a---b and c--d', { direction: 'to-smart' })).toBe('a—b and c–d')
    expect(await run('a---b', { direction: 'to-smart', dashes: false })).toBe('a---b')
  })

  it('uses the right quote pair for each locale', async () => {
    expect(await run('Er sagte "hallo"', { direction: 'to-smart', locale: 'de' }))
      .toBe('Er sagte „hallo“')
    expect(await run('Il a dit "oui"', { direction: 'to-smart', locale: 'fr' }))
      .toBe('Il a dit «\u202Foui\u202F»')
    expect(await run('On powiedział "cześć"', { direction: 'to-smart', locale: 'pl' }))
      .toBe('On powiedział „cześć”')
    expect(await run("mot 'cle'", { direction: 'to-smart', locale: 'fr' }))
      .toBe('mot ‹\u202Fcle\u202F›')
  })

  it('round-trips to-smart then to-straight', async () => {
    const plain = 'He said "hello", it\'s a \'test\'...'
    const smart = (await run(plain, { direction: 'to-smart' })) as string
    expect(await run(smart)).toBe(plain)

    const french = 'Il a dit "oui"'
    const smartFr = (await run(french, { direction: 'to-smart', locale: 'fr' })) as string
    expect(await run(smartFr)).toBe(french)

    // dashes must survive the round trip in both directions
    const dashes = 'a---b and c--d'
    expect(await run((await run(dashes, { direction: 'to-smart' })) as string)).toBe(dashes)
    const typographic = 'a—b and c–d'
    expect(await run((await run(typographic)) as string, { direction: 'to-smart' })).toBe(typographic)

    const german = 'Er sagte "hallo", \'ja\''
    const smartDe = (await run(german, { direction: 'to-smart', locale: 'de' })) as string
    expect(await run(smartDe)).toBe(german)
  })

  it('opens a quote that directly follows another opening quote', async () => {
    expect(await run('\'"x"\'', { direction: 'to-smart' })).toBe('‘“x”’')
    expect(await run('"she said \'hi\' now"', { direction: 'to-smart' }))
      .toBe('“she said ‘hi’ now”')
  })

  it('handles non-ascii text and keeps astral characters intact', async () => {
    expect(await run('« Ça va ? »')).toBe('"Ça va ?"')
    expect(await run('\u{1F389} "wow" \u{1F389}', { direction: 'to-smart' }))
      .toBe('\u{1F389} “wow” \u{1F389}')
    expect(await run('naïve “café”')).toBe('naïve "café"')
  })

  it('throws on an unknown direction or locale', async () => {
    await expect(async () => run('x', { direction: 'sideways' })).rejects.toThrow(/unknown direction/)
    await expect(async () => run('x', { direction: 'to-smart', locale: 'xx' })).rejects.toThrow(/unknown locale/)
    await expect(async () => run('x', { direction: 5 })).rejects.toThrow(/unknown direction/)
  })
})
