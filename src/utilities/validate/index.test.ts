import { describe, it, expect } from 'vitest'
import util, { VALIDATION_TYPES, parseIpv6, compressIpv6 } from './index'

type Result = { type: string; value: string; valid: boolean; reason: string; normalized?: string }
type PerLine = {
  type: string
  total: number
  validCount: number
  invalidCount: number
  results: { value: string; valid: boolean; reason: string; normalized?: string }[]
}

const run = async (value: string, type: string) =>
  (await util.apply(value, { type, perLine: false })) as unknown as Result

const check = async (value: string, type: string) => (await run(value, type)).valid

/** The spec's type list, written out literally so the options are checked against the
 *  specification rather than against whatever the implementation happens to export. */
const SPEC_TYPES = [
  'email', 'url', 'uuid', 'ipv4', 'ipv6', 'semver', 'credit-card', 'isbn', 'mac',
  'hex-color', 'json', 'base64', 'date', 'iso8601', 'domain', 'port', 'jwt', 'slug', 'hostname'
]

describe('validate', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('validate')
    expect(util.name).toBe('validate')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
    expect(util.params.type.default).toBe('email')
    expect((util.params.type as { options: string[] }).options).toEqual(SPEC_TYPES)
    // Every advertised option must actually be wired to a validator.
    expect(VALIDATION_TYPES).toEqual(SPEC_TYPES)
    expect(util.params.perLine.default).toBe(false)
  })

  it('validates emails, including internationalized ones', async () => {
    const res = await run('User.Name+tag@Example.CO.UK', 'email')
    expect(res).toMatchObject({ type: 'email', valid: true, normalized: 'User.Name+tag@example.co.uk' })
    expect(await check('josé@exämple.de', 'email')).toBe(true)
    expect(await check('"quoted local"@example.com', 'email')).toBe(true)
    expect((await run('not-an-email', 'email')).reason).toBe('missing "@"')
    expect((await run('a..b@example.com', 'email')).reason).toContain('..')
    expect(await check('user@example', 'email')).toBe(false)
    expect(await check('user@exam ple.com', 'email')).toBe(false)
  })

  it('validates urls, uuids and jwts', async () => {
    expect(await run('https://example.com/a?b=1#c', 'url'))
      .toMatchObject({ valid: true, normalized: 'https://example.com/a?b=1#c' })
    expect(await check('example.com', 'url')).toBe(false)
    expect(await check('https://exa mple.com', 'url')).toBe(false)

    const uuid = await run('550E8400-E29B-41D4-A716-446655440000', 'uuid')
    expect(uuid).toMatchObject({ valid: true, normalized: '550e8400-e29b-41d4-a716-446655440000' })
    expect(uuid.reason).toContain('version 4')
    expect(await check('00000000-0000-0000-0000-000000000000', 'uuid')).toBe(true)
    expect(await check('550e8400-e29b-41d4-c716-446655440000', 'uuid')).toBe(false)
    expect((await run('550e8400e29b41d4a716446655440000', 'uuid')).reason).toContain('missing hyphens')

    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    expect((await run(jwt, 'jwt')).valid).toBe(true)
    expect((await run(jwt, 'jwt')).reason).toContain('HS256')
    expect(await check('abc.def', 'jwt')).toBe(false)
    expect(await check('bm90LWpzb24.bm90LWpzb24.sig', 'jwt')).toBe(false)
  })

  it('validates ipv4, ipv6, ports, domains and hostnames', async () => {
    expect(await run('192.168.1.1', 'ipv4')).toMatchObject({ valid: true, reason: 'valid IPv4 address (private)' })
    expect(await check('256.1.1.1', 'ipv4')).toBe(false)
    expect((await run('010.1.1.1', 'ipv4')).reason).toContain('leading zero')

    expect((await run('255.255.255.255', 'ipv4')).reason).toBe('valid IPv4 address (broadcast)')
    expect((await run('240.0.0.1', 'ipv4')).reason).toBe('valid IPv4 address (reserved)')
    expect((await run('224.0.0.1', 'ipv4')).reason).toBe('valid IPv4 address (multicast)')

    expect(await run('2001:0DB8:85A3:0000:0000:8A2E:0370:7334', 'ipv6'))
      .toMatchObject({ valid: true, normalized: '2001:db8:85a3::8a2e:370:7334' })
    expect(await run('::ffff:192.168.0.1', 'ipv6'))
      .toMatchObject({ valid: true, normalized: '::ffff:192.168.0.1' })
    expect(await run('::1', 'ipv6'))
      .toMatchObject({ valid: true, reason: 'valid IPv6 address (loopback)', normalized: '::1' })
    expect(await check('1:::2', 'ipv6')).toBe(false)
    expect((await run('1:2:3:4:5:6:7:8:9', 'ipv6')).reason).toContain('8 groups')

    expect(await run('8080', 'port')).toMatchObject({ valid: true, normalized: '8080' })
    expect((await run('0', 'port')).reason).toContain('reserved')
    expect(await check('70000', 'port')).toBe(false)

    expect(await run('Sub.Example.CO.UK', 'domain')).toMatchObject({ valid: true, normalized: 'sub.example.co.uk' })
    expect(await check('münchen.de', 'domain')).toBe(true)
    expect(await check('localhost', 'domain')).toBe(false)
    expect(await check('-bad.example.com', 'domain')).toBe(false)

    expect(await run('localhost', 'hostname')).toMatchObject({ valid: true, normalized: 'localhost' })
    expect(await check('1.2.3.4', 'hostname')).toBe(false)
  })

  it('validates checksummed identifiers with Luhn and ISBN check digits', async () => {
    expect(await run('4111 1111 1111 1111', 'credit-card')).toMatchObject({ valid: true })
    expect((await run('378282246310005', 'credit-card')))
      .toMatchObject({ valid: true, normalized: '3782 822463 10005' })
    expect((await run('378282246310005', 'credit-card')).reason).toContain('American Express')
    expect((await run('4111111111111112', 'credit-card')).reason).toBe('fails the Luhn checksum')

    expect(await run('0-306-40615-2', 'isbn')).toMatchObject({ valid: true, normalized: '0306406152' })
    expect((await run('0-306-40615-2', 'isbn')).reason).toContain('9780306406157')
    expect(await check('978-0-306-40615-7', 'isbn')).toBe(true)
    expect(await check('080442957X', 'isbn')).toBe(true)
    expect(await check('0-306-40615-3', 'isbn')).toBe(false)
    expect(await check('978-0-306-40615-8', 'isbn')).toBe(false)
  })

  it('validates semver, mac addresses and hex colors', async () => {
    expect((await run('1.2.3-alpha.1+build.5', 'semver')).valid).toBe(true)
    expect(await run('v1.0.0', 'semver')).toMatchObject({ valid: true, normalized: '1.0.0' })
    expect((await run('1.2', 'semver')).reason).toContain('patch')
    expect(await check('01.2.3', 'semver')).toBe(false)

    expect(await run('00-1B-44-11-3A-B7', 'mac')).toMatchObject({ valid: true, normalized: '00:1b:44:11:3a:b7' })
    expect(await run('001b.4411.3ab7', 'mac')).toMatchObject({ valid: true, normalized: '00:1b:44:11:3a:b7' })
    expect((await run('02:00:00:00:00:01', 'mac')).reason).toContain('locally administered')
    expect(await check('00:1B:44:11:3A', 'mac')).toBe(false)

    expect(await run('#F0A', 'hex-color')).toMatchObject({ valid: true, normalized: '#ff00aa' })
    expect(await run('#11223344', 'hex-color')).toMatchObject({ valid: true, normalized: '#11223344' })
    expect(await check('#12345', 'hex-color')).toBe(false)
    expect(await check('#gggggg', 'hex-color')).toBe(false)
  })

  it('validates json, base64 and slugs', async () => {
    expect(await run(' {"a": [1, 2], "b": null} ', 'json'))
      .toMatchObject({ valid: true, normalized: '{"a":[1,2],"b":null}' })
    expect((await run('{"a":1,}', 'json')).valid).toBe(false)

    expect(await run('SGVsbG8gd29ybGQ=', 'base64')).toMatchObject({ valid: true })
    expect((await run('SGVsbG8gd29ybGQ=', 'base64')).reason).toContain('11 bytes')
    expect(await run('SGVsbG8td29ybGQ_', 'base64')).toMatchObject({ valid: true, normalized: 'SGVsbG8td29ybGQ/' })
    expect(await check('SGVsbG8*', 'base64')).toBe(false)
    expect(await check('SGVsbG8=d29ybGQ', 'base64')).toBe(false)

    expect(await run('hello-world-2', 'slug')).toMatchObject({ valid: true })
    // Unicode input is rejected but a usable slug is suggested.
    expect(await run('Héllo Wörld!', 'slug')).toMatchObject({ valid: false, normalized: 'hello-world' })
    expect(await check('double--hyphen', 'slug')).toBe(false)
    expect(await check('-leading', 'slug')).toBe(false)
  })

  it('validates dates and ISO 8601 forms with real calendar rules', async () => {
    expect(await run('2024-02-29', 'date')).toMatchObject({ valid: true, normalized: '2024-02-29' })
    expect((await run('2023-02-30', 'date')).reason).toContain('February 2023 has 28 days')
    expect(await run('12/31/2023', 'date')).toMatchObject({ valid: true, normalized: '2023-12-31' })
    expect(await run('31.12.2023', 'date')).toMatchObject({ valid: true, normalized: '2023-12-31' })
    expect(await check('nonsense', 'date')).toBe(false)

    expect(await run('2024-03-01T12:30:00Z', 'iso8601'))
      .toMatchObject({ valid: true, normalized: '2024-03-01T12:30:00.000Z' })
    expect(await check('2024-W05-1', 'iso8601')).toBe(true)
    expect(await check('2024-060', 'iso8601')).toBe(true)
    expect(await check('P3Y6M4DT12H30M5S', 'iso8601')).toBe(true)
    expect(await check('2024-01-01/2024-02-01', 'iso8601')).toBe(true)
    expect(await check('2024-13-01', 'iso8601')).toBe(false)
    expect(await check('2024T12:00', 'iso8601')).toBe(false)
    expect(await check('2024-03-01 12:30', 'iso8601')).toBe(false)
    expect(await check('2024-03-01T25:00:00Z', 'iso8601')).toBe(false)
  })

  it('exercises every type option end to end', async () => {
    const samples: Record<string, [string, string]> = {
      email: ['a@b.com', 'a@b'],
      url: ['https://a.com', 'a.com'],
      uuid: ['550e8400-e29b-41d4-a716-446655440000', 'nope'],
      ipv4: ['1.2.3.4', '1.2.3'],
      ipv6: ['::1', 'zz::1'],
      semver: ['1.0.0', 'one.two'],
      'credit-card': ['4111111111111111', '1234'],
      isbn: ['9780306406157', '123'],
      mac: ['00:1b:44:11:3a:b7', 'xx'],
      'hex-color': ['#abc', '#xyz'],
      json: ['[1,2]', '[1,'],
      base64: ['aGk=', '!!'],
      date: ['2020-01-01', 'blah'],
      iso8601: ['2020-01-01', 'blah'],
      domain: ['example.com', 'example'],
      port: ['443', '-1'],
      jwt: ['eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.sig', 'a.b'],
      slug: ['my-slug', 'My Slug'],
      hostname: ['db-1.internal', 'bad_host']
    }
    expect(Object.keys(samples).sort()).toEqual([...SPEC_TYPES].sort())
    for (const [type, [good, badValue]] of Object.entries(samples)) {
      expect(await run(good, type), `${type} should accept ${good}`).toMatchObject({ type, valid: true })
      expect(await check(badValue, type), `${type} should reject ${badValue}`).toBe(false)
    }
  })

  it('validates line by line when perLine is on', async () => {
    const res = (await util.apply('a@b.com\nnope\n\n  josé@exämple.de  ', {
      type: 'email', perLine: true
    })) as unknown as PerLine
    expect(res.type).toBe('email')
    expect(res.total).toBe(3)
    expect(res.validCount).toBe(2)
    expect(res.invalidCount).toBe(1)
    expect(res.results.map(r => r.valid)).toEqual([true, false, true])
    expect(res.results[2].value).toBe('josé@exämple.de')

    const none = (await util.apply('   \n\n', { type: 'email', perLine: true })) as unknown as PerLine
    expect(none.results).toEqual([])
    expect(none.total).toBe(0)
  })

  it('never throws on empty input', async () => {
    expect(await util.apply('', { type: 'email', perLine: false }))
      .toEqual({ type: 'email', value: '', valid: false, reason: 'empty input' })
    expect(await util.apply('   ', { type: 'json', perLine: false }))
      .toMatchObject({ valid: false, reason: 'empty input' })
    expect(await util.apply('', {})).toMatchObject({ type: 'email', valid: false })
  })

  it('throws on an unknown validation type', () => {
    expect(() => util.apply('a@b.com', { type: 'phone-number' })).toThrow(/unknown validation type/)
  })

  it('parses and canonicalizes IPv6 addresses', () => {
    expect(parseIpv6('::').groups).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(parseIpv6('fe80::1%eth0').zone).toBe('eth0')
    expect(compressIpv6(parseIpv6('[2001:db8:0:0:0:0:0:1]').groups)).toBe('2001:db8::1')
    expect(compressIpv6(parseIpv6('0:0:0:0:0:ffff:1.2.3.4').groups)).toBe('::ffff:1.2.3.4')
    expect(() => parseIpv6('1:2:3')).toThrow(/8 groups/)
  })

  // Expected values here match Python's `ipaddress` module, i.e. RFC 5952: the dotted
  // tail belongs to the IPv4-mapped ::ffff:0:0/96 prefix only. The deprecated
  // IPv4-compatible form must not be reintroduced, or ::1 renders as "::0.0.0.1".
  it('canonicalizes IPv6 exactly as RFC 5952 requires', () => {
    const canon = (s: string) => compressIpv6(parseIpv6(s).groups)
    expect(canon('::1')).toBe('::1')
    expect(canon('::')).toBe('::')
    expect(canon('::0.0.0.1')).toBe('::1')
    expect(canon('::0.0.1.2')).toBe('::102')
    expect(canon('::1.2.3.4')).toBe('::102:304')
    expect(canon('::192.168.1.1')).toBe('::c0a8:101')
    expect(canon('::ffff:0:0')).toBe('::ffff:0.0.0.0')
    // On a tie the *first* run of zeros is the one that collapses.
    expect(canon('2001:db8:0:0:1:0:0:1')).toBe('2001:db8::1:0:0:1')
    // A single zero group is never written as "::".
    expect(canon('1:2:3:4:5:6:0:8')).toBe('1:2:3:4:5:6:0:8')
    // An embedded IPv4 address is only legal as the final component.
    expect(() => parseIpv6('1.2.3.4::')).toThrow(/last component/)
    expect(() => parseIpv6('::ffff:1.2.3.4.5')).toThrow(/embedded IPv4/)
  })

  it('explains why a version, uuid or interval is rejected, not just that it is', async () => {
    expect((await run('01.2.3', 'semver')).reason).toBe('numeric identifiers must not have leading zeros')
    expect((await run('1.02.3', 'semver')).reason).toBe('numeric identifiers must not have leading zeros')
    expect((await run('1.2.3.4', 'semver')).reason).toContain('too many numeric components')
    expect((await run('1.0.0-01', 'semver')).reason).toContain('pre-release identifiers must not have leading zeros')
    // Build metadata, unlike numeric identifiers, may carry a leading zero.
    expect(await check('1.0.0+01', 'semver')).toBe(true)
    expect(await check('1.0.0-0a1', 'semver')).toBe(true)

    // Registry-format braces must match.
    expect(await check('{550e8400-e29b-41d4-a716-446655440000}', 'uuid')).toBe(true)
    expect(await check('urn:uuid:550e8400-e29b-41d4-a716-446655440000', 'uuid')).toBe(true)
    expect(await check('{550e8400-e29b-41d4-a716-446655440000)', 'uuid')).toBe(false)

    // 2024 is a 52-week ISO year; 2020 and 2015 are 53-week years.
    expect(await check('2024-W53', 'iso8601')).toBe(false)
    expect(await check('2020-W53', 'iso8601')).toBe(true)
    expect(await check('2015-W53-4', 'iso8601')).toBe(true)
    expect(await check('2024-01-01/P1M', 'iso8601')).toBe(true)
    expect(await check('P1M/2024-01-01', 'iso8601')).toBe(true)
    expect((await run('P1Y/P2Y', 'iso8601')).reason).toContain('two durations')
  })

  it('reports the exp claim without consulting the wall clock', async () => {
    // A JWT with exp=1700000000. The verdict must be a pure function of the input, so
    // the same token always yields the same reason no matter when the test runs.
    const token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3MDAwMDAwMDB9.sig'
    const res = await run(token, 'jwt')
    expect(res.valid).toBe(true)
    expect(res.reason).toBe(
      'well-formed JWT (alg HS256, expires 2023-11-14T22:13:20.000Z); the signature is not verified'
    )
    expect(res.reason).not.toMatch(/expired/)
    // alg "none" legitimately has an empty signature; any other alg does not.
    expect(await check('eyJhbGciOiJub25lIn0.eyJhIjoxfQ.', 'jwt')).toBe(true)
    expect((await run('eyJhbGciOiJIUzI1NiJ9.eyJhIjoxfQ.', 'jwt')).reason).toContain('signature is empty')
  })
})
