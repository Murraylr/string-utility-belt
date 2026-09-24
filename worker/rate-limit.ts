/**
 * Best-effort sliding-window limiter held in isolate memory.
 *
 * Cloudflare runs many isolates across many locations and recycles them freely, so
 * this only slows down a single client hammering one isolate; it is not a quota.
 * Real enforcement belongs in a Cloudflare WAF rate-limiting rule on `/api/fetch`.
 */
import { parseIPv6 } from './ssrf'

/**
 * The bucket a client IP counts against. An IPv6 client usually controls a whole /64
 * and could rotate through it, so IPv6 is limited per /64 (IPv4-mapped addresses as
 * the IPv4 they carry); anything unparseable is used verbatim.
 */
export function rateLimitKey(ip: string | null): string {
  const raw = (ip ?? '').trim()
  if (!raw) return 'unknown'
  const w = raw.includes(':') ? parseIPv6(raw) : null
  if (!w) return raw
  if (w.slice(0, 5).every(x => x === 0) && w[5] === 0xffff) {
    return [w[6] >> 8, w[6] & 0xff, w[7] >> 8, w[7] & 0xff].join('.')
  }
  return `${w.slice(0, 4).map(x => x.toString(16)).join(':')}::/64`
}

export interface RateLimiter {
  /** Records a hit for `key`; returns 0 when allowed, else the seconds until a slot frees up. */
  hit(key: string): number
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
  now?: () => number
  /** Keys tracked before stale ones are swept, bounding memory. */
  maxKeys?: number
}

export function createRateLimiter({ limit, windowMs, now = Date.now, maxKeys = 10_000 }: RateLimitOptions): RateLimiter {
  const hits = new Map<string, number[]>()

  const sweep = (t: number) => {
    for (const [k, list] of hits) {
      if (!list.length || list[list.length - 1] <= t - windowMs) hits.delete(k)
    }
    // still full of active clients: forget the oldest-inserted ones rather than grow without bound
    for (const k of hits.keys()) {
      if (hits.size < maxKeys) break
      hits.delete(k)
    }
  }

  return {
    hit(key) {
      const t = now()
      const list = (hits.get(key) ?? []).filter(ts => ts > t - windowMs)
      if (list.length >= limit) {
        hits.set(key, list)
        return Math.max(1, Math.ceil((list[0] + windowMs - t) / 1000))
      }
      list.push(t)
      if (!hits.has(key) && hits.size >= maxKeys) sweep(t)
      hits.set(key, list)
      return 0
    },
  }
}
