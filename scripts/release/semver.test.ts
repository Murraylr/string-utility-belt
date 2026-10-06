// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { bumpVersion, compareVersions, isVersion, maxLevel, newestAbove, parseVersion } from './semver'

describe('semver', () => {
  it('parses plain major.minor.patch versions only', () => {
    expect(parseVersion('1.14.0')).toEqual([1, 14, 0])
    for (const bad of ['1.4', '1.4.0-beta.1', '1.4.0+build', '01.4.0', 'v1.4.0', '1.4.0.1', '']) {
      expect(isVersion(bad), bad).toBe(false)
      expect(() => parseVersion(bad), bad).toThrow(/major\.minor\.patch/)
    }
  })

  it('compares numerically, not lexically', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.3.3', '1.3.10')).toBeLessThan(0)
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0)
  })

  it('bumps each level and resets the lower ones', () => {
    expect(bumpVersion('1.3.9', 'patch')).toBe('1.3.10')
    expect(bumpVersion('1.3.9', 'minor')).toBe('1.4.0')
    expect(bumpVersion('1.3.9', 'major')).toBe('2.0.0')
  })

  it('picks the largest level, defaulting to patch', () => {
    expect(maxLevel([])).toBe('patch')
    expect(maxLevel(['patch', 'minor'])).toBe('minor')
    expect(maxLevel(['major', 'minor', 'patch'])).toBe('major')
  })

  it('finds the newest version above another, ignoring anything that is not major.minor.patch', () => {
    expect(newestAbove(['1.3.0', '1.3.10', '1.3.2', 'latest', '2.0.0-beta.1'], '1.3.1')).toBe('1.3.10')
    expect(newestAbove(['1.3.0', '1.3.1'], '1.3.1')).toBeUndefined()
    expect(newestAbove([], '0.0.1')).toBeUndefined()
  })
})
