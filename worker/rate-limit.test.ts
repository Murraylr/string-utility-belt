// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createRateLimiter, rateLimitKey } from './rate-limit'

describe('createRateLimiter', () => {
  it('allows `limit` hits per sliding window, then reports seconds until a slot frees', () => {
    let now = 0
    const rl = createRateLimiter({ limit: 3, windowMs: 10_000, now: () => now })
    expect([rl.hit('a'), rl.hit('a'), rl.hit('a')]).toEqual([0, 0, 0])
    now = 2_500
    expect(rl.hit('a')).toBe(8) // oldest hit (t=0) expires at 10 s
    expect(rl.hit('b')).toBe(0)
    now = 10_001
    expect(rl.hit('a')).toBe(0)
  })

  it('does not count refused hits', () => {
    let now = 0
    const rl = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => now })
    rl.hit('a')
    for (let i = 0; i < 50; i++) rl.hit('a')
    now = 1_001
    expect(rl.hit('a')).toBe(0)
  })

  it('bounds memory: stale keys are swept, then the oldest are evicted', () => {
    let now = 0
    const rl = createRateLimiter({ limit: 1, windowMs: 1_000, now: () => now, maxKeys: 3 })
    rl.hit('a'); rl.hit('b'); rl.hit('c')
    now = 5_000 // a, b, c are all stale
    rl.hit('d')
    expect(rl.hit('a')).toBe(0) // was swept, so fresh again
    // d and a are active; e and f push the table past maxKeys, evicting the oldest-inserted
    rl.hit('e'); rl.hit('f')
    expect(rl.hit('f')).toBeGreaterThan(0) // most recent key is still tracked
  })
})

describe('rateLimitKey', () => {
  it('keys IPv4 clients by address', () => {
    expect(rateLimitKey('203.0.113.7')).toBe('203.0.113.7')
    expect(rateLimitKey(' 203.0.113.7 ')).toBe('203.0.113.7')
  })

  it('keys IPv6 clients by /64, however the address is spelled', () => {
    const key = rateLimitKey('2001:db8:1:2::1')
    expect(key).toBe('2001:db8:1:2::/64')
    expect(rateLimitKey('2001:0db8:0001:0002:ffff:ffff:ffff:ffff')).toBe(key)
    expect(rateLimitKey('2001:DB8:1:2:a:b:c:d')).toBe(key)
    expect(rateLimitKey('2001:db8:1:3::1')).not.toBe(key)
  })

  it('keys IPv4-mapped IPv6 by the IPv4 it carries', () => {
    expect(rateLimitKey('::ffff:203.0.113.7')).toBe('203.0.113.7')
    expect(rateLimitKey('::ffff:cb00:7107')).toBe('203.0.113.7')
  })

  it('falls back to the raw value, or one shared bucket when absent', () => {
    expect(rateLimitKey(null)).toBe('unknown')
    expect(rateLimitKey('')).toBe('unknown')
    expect(rateLimitKey('not-an-ip')).toBe('not-an-ip')
  })
})
