import { describe, it, expect } from 'vitest'
import util from './index'

describe('semver', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('semver')
    expect(util.name).toBe('semver')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params).sort()).toEqual(
      ['direction', 'mode', 'other', 'range', 'release'].sort()
    )
  })

  it('parses a realistic version into a real object', async () => {
    const out: any = await util.apply('1.2.3-alpha.1+build.7', { mode: 'parse' })
    expect(typeof out).toBe('object')
    expect(out.major).toBe(1)
    expect(out.minor).toBe(2)
    expect(out.patch).toBe(3)
    expect(out.prerelease).toEqual(['alpha', 1])
    expect(out.build).toEqual(['build', '7'])
    expect(out.version).toBe('1.2.3-alpha.1')
    expect(out.isPrerelease).toBe(true)
    expect(out.isStable).toBe(false)
  })

  it('parses a leading v, and boxes several lines in an object (never a bare array)', async () => {
    const single: any = await util.apply('v2.0.0', { mode: 'parse' })
    expect(single.version).toBe('2.0.0')
    expect(single.raw).toBe('v2.0.0')
    expect(single.isStable).toBe(true)

    const many: any = await util.apply('1.0.0\n2.0.0-rc.1', { mode: 'parse' })
    // A bare array would be rendered by the pipeline as "[object Object],[object Object]"
    // because runPipeline's valueType() only treats non-array objects as JSON.
    expect(Array.isArray(many)).toBe(false)
    expect(many.count).toBe(2)
    expect(many.results.map((r: any) => r.version)).toEqual(['1.0.0', '2.0.0-rc.1'])
    expect(many.results[1].prerelease).toEqual(['rc', 1])
  })

  it('never returns a bare array from any mode', async () => {
    const multi = '1.0.0\n2.0.0'
    for (const mode of ['parse', 'validate', 'satisfies']) {
      const out = await util.apply(multi, { mode, range: '^1.0.0' })
      expect(Array.isArray(out)).toBe(false)
      expect(typeof out).toBe('object')
    }
    for (const mode of ['sort', 'increment']) {
      expect(typeof (await util.apply(multi, { mode }))).toBe('string')
    }
  })

  it('returns an empty object for empty input and does not throw', async () => {
    expect(await util.apply('', {})).toEqual({})
    expect(await util.apply('   \n  ', { mode: 'validate' })).toEqual({})
    expect(await util.apply('', { mode: 'sort' })).toBe('')
    expect(await util.apply('', { mode: 'increment' })).toBe('')
  })

  it('validates without throwing, including a non-ASCII prerelease', async () => {
    const ok: any = await util.apply('v1.0.0+meta', { mode: 'validate' })
    expect(ok.valid).toBe(true)
    expect(ok.normalized).toBe('1.0.0')
    // "α" is not in the SemVer alphanumeric identifier set
    const bad: any = await util.apply('1.2.3-α', { mode: 'validate' })
    expect(bad.valid).toBe(false)
    expect(bad.reason).toMatch(/major\.minor\.patch/)
    const emoji: any = await util.apply('1.0.0-🎉', { mode: 'validate' })
    expect(emoji.valid).toBe(false)
  })

  it('throws on malformed versions in parse and sort modes', () => {
    expect(() => util.apply('1.2', { mode: 'parse' })).toThrow(/not a valid semver/)
    expect(() => util.apply('1.2.3\nbanana', { mode: 'sort' })).toThrow(/banana/)
    expect(() => util.apply('01.2.3', { mode: 'parse' })).toThrow()
    expect(() => util.apply('1.2.3-α', { mode: 'parse' })).toThrow()
  })

  it('compares with full prerelease precedence', async () => {
    const lt: any = await util.apply('1.0.0-alpha', { mode: 'compare', other: '1.0.0' })
    expect(lt.result).toBe(-1)
    expect(lt.relation).toBe('lt')
    expect(lt.description).toBe('1.0.0-alpha < 1.0.0')

    const gt: any = await util.apply('1.0.0-alpha.beta', { mode: 'compare', other: '1.0.0-alpha.1' })
    expect(gt.result).toBe(1)

    const eq: any = await util.apply('1.0.0+meta', { mode: 'compare', other: '1.0.0+other' })
    expect(eq.result).toBe(0)
    expect(eq.equalPrecedence).toBe(true)
  })

  it('requires the other param for compare', () => {
    expect(() => util.apply('1.0.0', { mode: 'compare', other: '' })).toThrow(/other version/)
    expect(() => util.apply('1.0.0', { mode: 'compare', other: 'nope' })).toThrow()
  })

  it('sorts by precedence in both directions', async () => {
    const input = '1.0.0\n1.0.0-rc.1\n1.0.0-alpha\n0.9.9\n2.0.0\n1.0.0-alpha.1'
    expect(await util.apply(input, { mode: 'sort', direction: 'asc' })).toBe(
      ['0.9.9', '1.0.0-alpha', '1.0.0-alpha.1', '1.0.0-rc.1', '1.0.0', '2.0.0'].join('\n')
    )
    expect(await util.apply(input, { mode: 'sort', direction: 'desc' })).toBe(
      ['2.0.0', '1.0.0', '1.0.0-rc.1', '1.0.0-alpha.1', '1.0.0-alpha', '0.9.9'].join('\n')
    )
  })

  it('orders the published semver.org §11 precedence examples exactly', async () => {
    // Verbatim from semver.org §11.2 / §11.4.
    const numeric = ['1.0.0', '2.0.0', '2.1.0', '2.1.1']
    expect(await util.apply([...numeric].reverse().join('\n'), { mode: 'sort' })).toBe(
      numeric.join('\n')
    )
    const prerelease = [
      '1.0.0-alpha',
      '1.0.0-alpha.1',
      '1.0.0-alpha.beta',
      '1.0.0-beta',
      '1.0.0-beta.2',
      '1.0.0-beta.11',
      '1.0.0-rc.1',
      '1.0.0'
    ]
    expect(await util.apply([...prerelease].reverse().join('\n'), { mode: 'sort' })).toBe(
      prerelease.join('\n')
    )
    // §11.3: a prerelease has LOWER precedence than the same normal version
    const before: any = await util.apply('1.0.0-alpha', { mode: 'compare', other: '1.0.0' })
    expect(before.result).toBe(-1)
  })

  it('checks caret, tilde, comparison, x and || ranges', async () => {
    const sat = async (v: string, range: string) =>
      ((await util.apply(v, { mode: 'satisfies', range })) as any).satisfies

    expect(await sat('1.2.9', '^1.2.0')).toBe(true)
    expect(await sat('2.0.0', '^1.2.0')).toBe(false)
    expect(await sat('0.2.9', '^0.2.3')).toBe(true)
    expect(await sat('0.3.0', '^0.2.3')).toBe(false)
    expect(await sat('1.2.9', '~1.2.3')).toBe(true)
    expect(await sat('1.3.0', '~1.2.3')).toBe(false)
    expect(await sat('1.5.0', '>=1.2.3 <2.0.0')).toBe(true)
    expect(await sat('2.0.0', '>=1.2.3 <2.0.0')).toBe(false)
    expect(await sat('1.9.0', '1.x')).toBe(true)
    expect(await sat('3.1.0', '^1.0.0 || >=3.0.0')).toBe(true)
    expect(await sat('1.2.3', '=1.2.3')).toBe(true)
    expect(await sat('1.2.4', '<=1.2.3')).toBe(false)
    expect(await sat('1.2.3', '1.2.3 - 2.0.0')).toBe(true)
    // an empty range means "anything"
    expect(await sat('9.9.9', '')).toBe(true)
  })

  it('only matches prereleases inside a range that names the same tuple', async () => {
    const sat = async (v: string, range: string) =>
      ((await util.apply(v, { mode: 'satisfies', range })) as any).satisfies
    expect(await sat('1.2.3-beta.1', '>=1.2.3-alpha <2.0.0')).toBe(true)
    expect(await sat('1.2.3-beta.1', '^1.0.0')).toBe(false)
    const many: any = await util.apply('1.0.0\n2.0.0', { mode: 'satisfies', range: '^1.0.0' })
    expect(many.results.map((r: any) => r.satisfies)).toEqual([true, false])
    expect(many.results[0]).toEqual({ version: '1.0.0', range: '^1.0.0', satisfies: true })
    expect(() => util.apply('1.0.0', { mode: 'satisfies', range: '>=not.a.version' })).toThrow()
  })

  it('increments every release type', async () => {
    const inc = (v: string, release: string, other = '') =>
      util.apply(v, { mode: 'increment', release, other })
    expect(await inc('1.2.3', 'patch')).toBe('1.2.4')
    expect(await inc('1.2.3', 'minor')).toBe('1.3.0')
    expect(await inc('1.2.3', 'major')).toBe('2.0.0')
    expect(await inc('1.0.0-alpha.1', 'major')).toBe('1.0.0')
    expect(await inc('1.2.3', 'premajor')).toBe('2.0.0-0')
    expect(await inc('1.2.3', 'preminor', 'beta')).toBe('1.3.0-beta.0')
    expect(await inc('1.2.3', 'prepatch', 'rc')).toBe('1.2.4-rc.0')
    expect(await inc('1.2.4-rc.0', 'prerelease', 'rc')).toBe('1.2.4-rc.1')
    expect(await inc('1.2.3', 'prerelease')).toBe('1.2.4-0')
    expect(await inc('1.0.0\n2.3.4', 'patch')).toBe('1.0.1\n2.3.5')
  })

  it('rejects an unknown mode', () => {
    expect(() => util.apply('1.0.0', { mode: 'teleport' })).toThrow(/unknown mode/)
  })
})
