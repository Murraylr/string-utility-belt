import { describe, expect, it } from 'vitest'
import { relativeTime } from './time'

const NOW = Date.UTC(2026, 8, 23, 12, 0, 0)

describe('relativeTime', () => {
  it('describes past instants in the largest whole unit', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('30 seconds ago')
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5 minutes ago')
    expect(relativeTime(NOW - 3 * 3_600_000, NOW)).toBe('3 hours ago')
    expect(relativeTime(NOW - 86_400_000, NOW)).toBe('yesterday')
    expect(relativeTime(NOW - 2 * 7 * 86_400_000, NOW)).toBe('2 weeks ago')
    expect(relativeTime(NOW - 400 * 86_400_000, NOW)).toBe('last year')
  })

  it('handles "just now" and future instants (clock skew between devices)', () => {
    expect(relativeTime(NOW, NOW)).toBe('now')
    expect(relativeTime(NOW + 2 * 3_600_000, NOW)).toBe('in 2 hours')
  })
})
