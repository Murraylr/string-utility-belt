import { describe, it, expect } from 'vitest'
import util from './index'

describe('cidr', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('cidr')
    expect(util.name).toBe('cidr tools')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params)).toEqual(['mode', 'address', 'newPrefix', 'limit'])
  })

  it('reports IPv4 block info', async () => {
    expect(await util.apply('192.168.1.0/24', { mode: 'info' })).toEqual({
      network: '192.168.1.0',
      broadcast: '192.168.1.255',
      firstHost: '192.168.1.1',
      lastHost: '192.168.1.254',
      netmask: '255.255.255.0',
      wildcard: '0.0.0.255',
      prefix: 24,
      totalHosts: 256,
      usableHosts: 254,
      isPrivate: true,
      version: 4
    })
    // a host address is normalised down to its network
    const thirty = (await util.apply('10.0.0.5/30', {})) as Record<string, unknown>
    expect(thirty.network).toBe('10.0.0.4')
    expect(thirty.usableHosts).toBe(2)
    // RFC 3021 point-to-point: both addresses are usable
    const p2p = (await util.apply('203.0.113.5/31', {})) as Record<string, unknown>
    expect(p2p.usableHosts).toBe(2)
    // a bare address is a single host
    const host = (await util.apply('8.8.8.8', {})) as Record<string, unknown>
    expect(host.prefix).toBe(32)
    expect(host.totalHosts).toBe(1)
    // a non-byte-aligned prefix still masks correctly
    expect(await util.apply('10.11.12.13/20', {})).toMatchObject({
      network: '10.11.0.0',
      broadcast: '10.11.15.255',
      netmask: '255.255.240.0',
      wildcard: '0.0.15.255',
      usableHosts: 4094
    })
  })

  // isPrivate means "not globally routable"; expectations cross-checked against
  // Python 3.13 `ipaddress.ip_network(...).is_private`.
  it('flags every IANA special-purpose range as private', async () => {
    const isPrivate = async (cidr: string) =>
      ((await util.apply(cidr, { mode: 'info' })) as Record<string, unknown>).isPrivate
    for (const block of [
      '10.1.2.0/24',
      '172.16.5.0/24',
      '192.168.1.0/24',
      '127.0.0.1',
      '169.254.1.1',
      '100.64.0.0/10',
      '192.0.2.0/24',
      '198.51.100.0/24',
      '203.0.113.0/24',
      '240.0.0.0/4',
      '255.255.255.255',
      'fc00::/7',
      'fe80::/10',
      '2001:db8::/32',
      '::1'
    ]) {
      expect(await isPrivate(block), block).toBe(true)
    }
    for (const block of [
      '8.8.8.8',
      '1.1.1.0/24',
      '203.0.112.0/24',
      '224.0.0.0/4',
      '2606:4700::/32',
      'ff02::1'
    ]) {
      expect(await isPrivate(block), block).toBe(false)
    }
    // a block that only straddles a private range is not itself private
    expect(await isPrivate('172.16.0.0/11')).toBe(false)
  })

  it('reports IPv6 block info', async () => {
    expect(await util.apply('2001:db8::/126', { mode: 'info' })).toEqual({
      network: '2001:db8::',
      broadcast: '2001:db8::3',
      firstHost: '2001:db8::',
      lastHost: '2001:db8::3',
      netmask: 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:fffc',
      wildcard: '::3',
      prefix: 126,
      totalHosts: 4,
      usableHosts: 4,
      isPrivate: true, // 2001:db8::/32 is the documentation range
      version: 6
    })
    // counts past 2^53 - 1 stay exact as decimal strings
    const slash64 = (await util.apply('fd00::/64', {})) as Record<string, unknown>
    expect(slash64.totalHosts).toBe('18446744073709551616')
    expect(slash64.isPrivate).toBe(true)
    expect(slash64.version).toBe(6)
    // masks are bit patterns, never rendered as IPv4-mapped addresses
    expect(await util.apply('2606:4700::/80', { mode: 'info' })).toMatchObject({
      netmask: 'ffff:ffff:ffff:ffff:ffff::',
      wildcard: '::ffff:ffff:ffff',
      broadcast: '2606:4700::ffff:ffff:ffff'
    })
  })

  it('expands a block, honouring limit', async () => {
    expect(await util.apply('192.168.1.0/30', { mode: 'expand' })).toBe(
      '192.168.1.0\n192.168.1.1\n192.168.1.2\n192.168.1.3'
    )
    expect(await util.apply('192.168.1.0/30', { mode: 'expand', limit: 2 })).toBe(
      '192.168.1.0\n192.168.1.1\n... 2 more (raise limit)'
    )
    expect(await util.apply('2001:db8::/127', { mode: 'expand' })).toBe('2001:db8::\n2001:db8::1')
  })

  it('tests containment of an address or a sub-block', async () => {
    expect(await util.apply('10.0.0.0/8', { mode: 'contains', address: '10.1.2.3' })).toEqual({
      cidr: '10.0.0.0/8',
      address: '10.1.2.3',
      contains: true,
      version: 4
    })
    const sub = (await util.apply('10.0.0.0/8', { mode: 'contains', address: '10.1.0.0/16' })) as Record<
      string,
      unknown
    >
    expect(sub.contains).toBe(true)
    expect(sub.address).toBe('10.1.0.0/16')
    const outside = (await util.apply('10.0.0.0/8', { mode: 'contains', address: '11.0.0.1' })) as Record<
      string,
      unknown
    >
    expect(outside.contains).toBe(false)
    // a different family is never contained
    const crossFamily = (await util.apply('10.0.0.0/8', {
      mode: 'contains',
      address: '2001:db8::1'
    })) as Record<string, unknown>
    expect(crossFamily.contains).toBe(false)
  })

  it('splits a block into smaller subnets', async () => {
    expect(await util.apply('192.168.0.0/24', { mode: 'split', newPrefix: 26 })).toBe(
      '192.168.0.0/26\n192.168.0.64/26\n192.168.0.128/26\n192.168.0.192/26'
    )
    expect(await util.apply('192.168.0.0/24', { mode: 'split', newPrefix: 26, limit: 2 })).toBe(
      '192.168.0.0/26\n192.168.0.64/26\n... 2 more (raise limit)'
    )
    expect(await util.apply('2001:db8::/32', { mode: 'split', newPrefix: 34 })).toBe(
      '2001:db8::/34\n2001:db8:4000::/34\n2001:db8:8000::/34\n2001:db8:c000::/34'
    )
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', { mode: 'info' })).toEqual({})
    expect(await util.apply('   ', { mode: 'contains', address: '10.0.0.1' })).toEqual({})
    expect(await util.apply('\n', { mode: 'expand' })).toBe('')
    expect(await util.apply('', { mode: 'split', newPrefix: 26 })).toBe('')
  })

  it('throws clear errors on bad blocks and parameters', async () => {
    expect(() => util.apply('not-a-cidr', {})).toThrow(/not a valid IP address/)
    expect(() => util.apply('192.168.1.0/33', {})).toThrow(/out of range/)
    expect(() => util.apply('192.168.1.0/abc', {})).toThrow(/invalid prefix/)
    expect(() => util.apply('192.168.0.0/24', { mode: 'split' })).toThrow(/newPrefix/)
    expect(() => util.apply('192.168.0.0/24', { mode: 'split', newPrefix: 24 })).toThrow(/longer/)
    expect(() => util.apply('192.168.0.0/24', { mode: 'split', newPrefix: 40 })).toThrow(/out of range/)
    expect(() => util.apply('10.0.0.0/8', { mode: 'contains', address: '' })).toThrow(/address param/)
    // full-width digits are not ASCII CIDR syntax
    expect(() => util.apply('１９２.168.1.0/24', {})).toThrow(/not a valid IP address/)
    // a leading zero is octal to inet_aton, so it must not be read as decimal
    expect(() => util.apply('010.0.0.1/8', {})).toThrow(/not a valid IP address/)
    expect(() => util.apply('10.0.0.0/8', { mode: 'contains', address: '010.0.0.1' })).toThrow(
      /not a valid IP address/
    )
    // whitespace around the slash is tolerated
    expect(await util.apply(' 192.168.1.0 / 24 ', {})).toMatchObject({ network: '192.168.1.0', prefix: 24 })
  })
})
