import { describe, it, expect } from 'vitest'
import util from './index'

describe('ip_convert', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('ip_convert')
    expect(util.name).toBe('ip convert')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['mode', 'perLine'])
  })

  it('auto-detects the conversion direction', async () => {
    // dotted quad -> integer
    expect(await util.apply('192.168.1.1', { mode: 'auto' })).toBe('3232235777')
    // integer -> address
    expect(await util.apply('3232235777', { mode: 'auto' })).toBe('192.168.1.1')
    // shorthand IPv6 -> expanded
    expect(await util.apply('2001:db8::1', { mode: 'auto' })).toBe(
      '2001:0db8:0000:0000:0000:0000:0000:0001'
    )
    // fully expanded IPv6 -> compressed
    expect(await util.apply('2001:0db8:0000:0000:0000:0000:0000:0001', { mode: 'auto' })).toBe(
      '2001:db8::1'
    )
  })

  it('converts addresses to integers and back', async () => {
    expect(await util.apply('0.0.0.0', { mode: 'to-integer' })).toBe('0')
    expect(await util.apply('255.255.255.255', { mode: 'to-integer' })).toBe('4294967295')
    expect(await util.apply('::1', { mode: 'to-integer' })).toBe('1')
    expect(await util.apply('::ffff:192.168.1.1', { mode: 'to-integer' })).toBe('281473913979137')
    expect(await util.apply('4294967295', { mode: 'to-address' })).toBe('255.255.255.255')
    expect(await util.apply('281473913979137', { mode: 'to-address' })).toBe('::ffff:192.168.1.1')
    // 0x / 0b integer literals are accepted
    expect(await util.apply('0xc0a80101', { mode: 'to-address' })).toBe('192.168.1.1')
    expect(await util.apply('0b11000000101010000000000100000001', { mode: 'to-address' })).toBe(
      '192.168.1.1'
    )
  })

  it('expands and compresses IPv6 (round trip)', async () => {
    const expanded = await util.apply('fe80::a1b:2%eth0', { mode: 'ipv6-expand' })
    expect(expanded).toBe('fe80:0000:0000:0000:0000:0000:0a1b:0002')
    expect(await util.apply(String(expanded), { mode: 'ipv6-compress' })).toBe('fe80::a1b:2')
    expect(await util.apply('0:0:0:0:0:0:0:0', { mode: 'ipv6-compress' })).toBe('::')
    // RFC 5952 4.2.3: only the longest zero run collapses...
    expect(await util.apply('2001:0:0:1:0:0:0:1', { mode: 'ipv6-compress' })).toBe('2001:0:0:1::1')
    // ...and the first of two equal-length runs wins
    expect(await util.apply('2001:0:0:1:0:0:2:1', { mode: 'ipv6-compress' })).toBe('2001::1:0:0:2:1')
    // a single zero group is never collapsed to '::'
    expect(await util.apply('1:2:3:4:5:6:0:8', { mode: 'ipv6-compress' })).toBe('1:2:3:4:5:6:0:8')
    // embedded dotted quad is parsed
    expect(await util.apply('::ffff:1.2.3.4', { mode: 'ipv6-expand' })).toBe(
      '0000:0000:0000:0000:0000:ffff:0102:0304'
    )
  })

  it('renders binary and hex for both versions', async () => {
    expect(await util.apply('192.168.1.1', { mode: 'to-binary' })).toBe(
      '11000000.10101000.00000001.00000001'
    )
    // integers are accepted wherever an address is
    expect(await util.apply('3232235777', { mode: 'to-binary' })).toBe(
      '11000000.10101000.00000001.00000001'
    )
    expect(await util.apply('192.168.1.1', { mode: 'to-hex' })).toBe('0xc0a80101')
    expect(await util.apply('::1', { mode: 'to-hex' })).toBe('0x00000000000000000000000000000001')
    expect(await util.apply('::1', { mode: 'to-binary' })).toBe(
      '0000000000000000:0000000000000000:0000000000000000:0000000000000000:0000000000000000:0000000000000000:0000000000000000:0000000000000001'
    )
  })

  it('maps IPv4 into IPv6', async () => {
    expect(await util.apply('192.168.1.1', { mode: 'ipv4-to-ipv6' })).toBe('::ffff:192.168.1.1')
    expect(await util.apply('0.0.0.0', { mode: 'ipv4-to-ipv6' })).toBe('::ffff:0.0.0.0')
    expect(() => util.apply('2001:db8::1', { mode: 'ipv4-to-ipv6' })).toThrow(/IPv4/)
  })

  it('honours perLine', async () => {
    const input = '192.168.1.1\n\n10.0.0.1'
    expect(await util.apply(input, { mode: 'to-integer', perLine: true })).toBe(
      '3232235777\n\n167772161'
    )
    // perLine off treats the whole (trimmed) input as one address
    expect(await util.apply('  10.0.0.1  ', { mode: 'to-integer', perLine: false })).toBe('167772161')
    expect(() => util.apply(input, { mode: 'to-integer', perLine: false })).toThrow()
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n  ', { mode: 'to-hex' })).toBe('')
  })

  it('throws clear errors on malformed input', async () => {
    expect(() => util.apply('not.an.ip', {})).toThrow(/not a valid IP address/)
    expect(() => util.apply('999.1.1.1', { mode: 'to-integer' })).toThrow(/not a valid IP address/)
    expect(() => util.apply('1:2:3:4:5:6:7:8:9', { mode: 'to-integer' })).toThrow()
    expect(() => util.apply('abc', { mode: 'to-address' })).toThrow(/not an integer/)
    expect(() => util.apply('1.2.3.4', { mode: 'ipv6-expand' })).toThrow(/IPv6/)
    expect(() => util.apply('340282366920938463463374607431768211456', { mode: 'to-address' })).toThrow(
      /too large/
    )
    // full-width digits are not ASCII IP syntax
    expect(() => util.apply('１９２.１６８.１.１', {})).toThrow(/not a valid IP address/)
  })

  it('rejects octal-ambiguous dotted quads', async () => {
    // inet_aton reads 010 as 8, so a leading zero must not be accepted as decimal 10
    expect(() => util.apply('010.0.0.1', { mode: 'to-integer' })).toThrow(/not a valid IP address/)
    expect(() => util.apply('01.02.03.04', { mode: 'to-integer' })).toThrow(/not a valid IP address/)
    expect(() => util.apply('::ffff:01.02.03.04', { mode: 'to-integer' })).toThrow(
      /not a valid IP address/
    )
    // a bare zero octet is still fine
    expect(await util.apply('10.0.0.1', { mode: 'to-integer' })).toBe('167772161')
  })

  it('only accepts well-formed digit separators in integers', async () => {
    expect(await util.apply('3,232,235,777', { mode: 'to-address' })).toBe('192.168.1.1')
    expect(await util.apply('3_232_235_777', { mode: 'to-address' })).toBe('192.168.1.1')
    // ragged comma groups are not a number, they are four numbers
    expect(() => util.apply('1,2,3,4', { mode: 'to-address' })).toThrow(/not an integer/)
    expect(() => util.apply('1__0', { mode: 'to-address' })).toThrow(/not an integer/)
  })

  it('round-trips expand and compress for every representative form', async () => {
    const addresses = [
      '::',
      '::1',
      '2001:db8::1',
      'fe80::a1b:2',
      '1:2:3:4:5:6:7:8',
      'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
      '::ffff:192.168.1.1'
    ]
    for (const a of addresses) {
      const expanded = String(await util.apply(a, { mode: 'ipv6-expand' }))
      expect(expanded, a).toMatch(/^[0-9a-f]{4}(:[0-9a-f]{4}){7}$/)
      expect(await util.apply(expanded, { mode: 'ipv6-compress' }), a).toBe(a)
    }
  })
})
