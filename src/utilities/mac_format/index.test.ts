import { describe, it, expect } from 'vitest'
import util from './index'

describe('mac_format', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('mac_format')
    expect(util.name).toBe('mac address format')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toEqual(['string', 'json'])
    expect(Object.keys(util.params)).toEqual(['style', 'case', 'perLine', 'validate', 'info'])
  })

  it('renders every style', async () => {
    const mac = '00-1A-2B-3C-4D-5E'
    expect(await util.apply(mac, { style: 'colon' })).toBe('00:1a:2b:3c:4d:5e')
    expect(await util.apply(mac, { style: 'dash' })).toBe('00-1a-2b-3c-4d-5e')
    expect(await util.apply(mac, { style: 'dot' })).toBe('00.1a.2b.3c.4d.5e')
    expect(await util.apply(mac, { style: 'bare' })).toBe('001a2b3c4d5e')
    expect(await util.apply(mac, { style: 'cisco' })).toBe('001a.2b3c.4d5e')
  })

  it('honours the case option and accepts any input separator', async () => {
    expect(await util.apply('001a.2b3c.4d5e', { style: 'colon', case: 'upper' })).toBe(
      '00:1A:2B:3C:4D:5E'
    )
    expect(await util.apply('0x001A2B3C4D5E', { style: 'dash', case: 'lower' })).toBe(
      '00-1a-2b-3c-4d-5e'
    )
    // EUI-64 (16 hex digits) is supported too
    expect(await util.apply('00:1a:2b:ff:fe:3c:4d:5e', { style: 'cisco' })).toBe(
      '001a.2bff.fe3c.4d5e'
    )
  })

  it('honours perLine', async () => {
    const input = '00-1a-2b-3c-4d-5e\n\nAA:BB:CC:DD:EE:FF'
    expect(await util.apply(input, { style: 'bare', perLine: true })).toBe(
      '001a2b3c4d5e\n\naabbccddeeff'
    )
    // perLine off folds the whole input into one address, so two MACs are 24 digits and invalid
    expect(() => util.apply(input, { perLine: false })).toThrow(/not a valid MAC address/)
    expect(await util.apply('00 1a 2b 3c 4d 5e', { perLine: false })).toBe('00:1a:2b:3c:4d:5e')
  })

  it('reports OUI, multicast and locally administered bits', async () => {
    expect(await util.apply('00:1a:2b:3c:4d:5e', { info: true })).toEqual({
      address: '00:1a:2b:3c:4d:5e',
      bare: '001a2b3c4d5e',
      oui: '00:1a:2b',
      nic: '3c:4d:5e',
      bits: 48,
      isMulticast: false,
      isLocallyAdministered: false,
      isBroadcast: false,
      valid: true
    })
    const local = (await util.apply('02:00:00:00:00:01', { info: true })) as Record<string, unknown>
    expect(local.isLocallyAdministered).toBe(true)
    expect(local.isMulticast).toBe(false)
    const multicast = (await util.apply('01:00:5e:00:00:fb', { info: true })) as Record<string, unknown>
    expect(multicast.isMulticast).toBe(true)
    const broadcast = (await util.apply('ff:ff:ff:ff:ff:ff', { info: true })) as Record<string, unknown>
    expect(broadcast.isBroadcast).toBe(true)
    // several lines produce an array of rows
    const rows = (await util.apply('00:1a:2b:3c:4d:5e\n02:00:00:00:00:01', {
      info: true,
      style: 'cisco'
    })) as unknown as Array<Record<string, unknown>>
    expect(rows).toHaveLength(2)
    expect(rows[1].address).toBe('0200.0000.0001')
    expect(rows[1].oui).toBe('020000')
    // 33:33:.. is the IPv6 multicast prefix: group bit and local bit are both set
    const v6mc = (await util.apply('33:33:00:00:00:01', { info: true })) as Record<string, unknown>
    expect(v6mc.isMulticast).toBe(true)
    expect(v6mc.isLocallyAdministered).toBe(true)
    // EUI-64 keeps the 3-byte OUI and reports 64 bits, and case carries into the details
    expect(await util.apply('00:1a:2b:ff:fe:3c:4d:5e', { info: true, case: 'upper' })).toMatchObject({
      bare: '001A2BFFFE3C4D5E',
      oui: '00:1A:2B',
      nic: 'FF:FE:3C:4D:5E',
      bits: 64
    })
  })

  it('passes unparsable lines through when validate is off', async () => {
    expect(await util.apply('hello\n00:1a:2b:3c:4d:5e', { validate: false, style: 'bare' })).toBe(
      'hello\n001a2b3c4d5e'
    )
    const rows = (await util.apply('hello', { validate: false, info: true })) as Record<string, unknown>
    expect(rows.valid).toBe(false)
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  \n ', { info: true })).toEqual({})
  })

  it('throws clear errors on invalid MAC addresses', async () => {
    expect(() => util.apply('zz:1a:2b:3c:4d:5e', {})).toThrow(/not a valid MAC address/)
    expect(() => util.apply('00:1a:2b:3c:4d', {})).toThrow(/not a valid MAC address/)
    expect(() => util.apply('00:1a:2b:3c:4d:5e:7f', {})).toThrow(/not a valid MAC address/)
    // full-width digits are not ASCII hex
    expect(() => util.apply('００:1a:2b:3c:4d:5e', {})).toThrow(/not a valid MAC address/)
    expect(() => util.apply('00:1a:2b:3c:4d:5e\nnope', { info: true })).toThrow(
      /not a valid MAC address/
    )
  })
})
