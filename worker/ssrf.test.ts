// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { checkTarget, classifyHost, parseIPv4, parseIPv6 } from './ssrf'

/** [url, why it must be refused]. Every one must come back 403 (blocked host). */
const BLOCKED: Array<[string, string]> = [
  // names
  ['http://localhost/', 'localhost'],
  ['http://LOCALHOST:8080/', 'localhost, upper case, port'],
  ['http://localhost./', 'localhost, trailing dot'],
  ['http://localhost../', 'localhost, two trailing dots'],
  ['http://%6c%6fcalhost/', 'percent-encoded localhost'],
  ['http://ⓛⓞⓒⓐⓛⓗⓞⓢⓣ/', 'IDNA-mapped localhost'],
  ['http://api.localhost/', '*.localhost'],
  ['http://printer.local/', '*.local (mDNS)'],
  ['http://metadata.google.internal/computeMetadata/v1/', '*.internal (GCP metadata)'],
  ['http://foo.internal./', '*.internal, trailing dot'],
  ['http://nas.home.arpa/', '*.home.arpa'],
  ['http://1.0.0.127.in-addr.arpa/', '*.arpa'],
  ['http://router.lan/', '*.lan'],
  ['http://box.localdomain/', '*.localdomain'],
  ['http://intranet/', 'single-label name'],
  ['http://metadata/', 'single-label metadata alias'],
  ['http://127.0.0.1.nip.io/', 'wildcard DNS to loopback'],
  ['http://app.localtest.me/', 'wildcard DNS to loopback'],
  // security review: nip.io has many clones (traefik.me, localhost.direct, …); a name
  // that spells out a non-public address is refused whatever service would resolve it
  ['http://127.0.0.1.traefik.me/', 'wildcard DNS clone, dotted loopback'],
  ['http://app.10.0.0.5.example.net/', 'name embedding a dotted private address'],
  ['http://169.254.169.254.example.com/', 'name embedding the metadata address'],
  ['http://0x7f.0.0.1.example.com/', 'name embedding a hex-spelled loopback'],
  ['http://10-0-0-1.example.org/', 'name embedding a dashed private address'],
  ['http://www-192-168-1-1.rebind.example/', 'dashed private address inside a label'],
  ['http://x-1-10-0-0-1.example.com/', 'dashed private address after a public-looking run'],
  // IPv4 loopback in every spelling
  ['http://127.0.0.1/', 'loopback'],
  ['http://127.0.0.1./', 'loopback, trailing dot'],
  ['http://127.0.0.1%2e/', 'loopback, encoded trailing dot'],
  ['http://127.1/', 'loopback, shortened'],
  ['http://127.000.000.001/', 'loopback, zero-padded'],
  ['http://2130706433/', 'loopback, decimal integer'],
  ['http://0x7f000001/', 'loopback, hex integer'],
  ['http://0x7f.1/', 'loopback, hex + shortened'],
  ['http://0x7f.0x0.0x0.0x1/', 'loopback, dotted hex'],
  ['http://017700000001/', 'loopback, octal integer'],
  ['http://0177.0.0.1/', 'loopback, dotted octal'],
  ['http://１２７.０.０.１/', 'loopback, full-width digits'],
  ['http://127。0。0。1/', 'loopback, ideographic full stops'],
  ['http://①②⑦.0.0.1/', 'loopback, enclosed alphanumerics'],
  ['http://%31%32%37.0.0.1/', 'loopback, percent-encoded digits'],
  ['http://0X7F.1/', 'loopback, upper-case hex'],
  ['http://00000177.0.0.1/', 'loopback, long octal'],
  ['http://127.0.0.1\t/', 'loopback, stripped tab'],
  ['http://127.255.255.254/', 'loopback /8'],
  // IPv4 special ranges
  ['http://0/', 'unspecified (0)'],
  ['http://0.0.0.0/', 'unspecified'],
  ['http://0x/', 'unspecified, bare 0x'],
  ['http://10.0.0.1/', 'private 10/8'],
  ['http://172.16.0.1/', 'private 172.16/12'],
  ['http://172.31.255.255/', 'private 172.16/12 upper edge'],
  ['http://192.168.1.1/', 'private 192.168/16'],
  ['http://169.254.169.254/latest/meta-data/', 'AWS/GCP/Azure metadata'],
  ['http://⑯⑨。②⑤④。⑯⑨｡②⑤④/', 'metadata, enclosed alphanumerics'],
  ['http://169.254.170.2/v2/credentials', 'ECS task metadata (link-local)'],
  ['http://2852039166/', 'metadata as decimal integer'],
  ['http://169.254.1.1/', 'link-local'],
  ['http://100.64.0.1/', 'CGNAT'],
  ['http://100.127.255.255/', 'CGNAT upper edge'],
  ['http://100.100.100.200/', 'Alibaba metadata'],
  ['http://168.63.129.16/', 'Azure wireserver'],
  ['http://192.0.0.192/', 'Oracle metadata'],
  ['http://192.0.0.8/', 'IETF protocol assignments'],
  ['http://192.0.2.1/', 'TEST-NET-1'],
  ['http://198.51.100.7/', 'TEST-NET-2'],
  ['http://203.0.113.9/', 'TEST-NET-3'],
  ['http://198.18.0.1/', 'benchmarking'],
  ['http://198.19.255.255/', 'benchmarking upper edge'],
  ['http://192.88.99.1/', '6to4 relay anycast'],
  ['http://224.0.0.1/', 'multicast'],
  ['http://239.255.255.250/', 'multicast (SSDP)'],
  ['http://240.0.0.1/', 'reserved'],
  ['http://255.255.255.255/', 'broadcast'],
  // IPv6
  ['http://[::1]/', 'loopback'],
  ['http://[0000::1]/', 'loopback, padded'],
  ['http://[0:0:0:0:0:0:0:1]/', 'loopback, uncompressed'],
  ['http://[::]/', 'unspecified'],
  ['http://[::ffff:127.0.0.1]/', 'IPv4-mapped loopback (dotted)'],
  ['http://[::ffff:7f00:1]/', 'IPv4-mapped loopback (hex)'],
  ['http://[0:0:0:0:0:ffff:127.0.0.1]/', 'IPv4-mapped loopback, uncompressed'],
  ['http://[::ffff:10.0.0.1]/', 'IPv4-mapped private'],
  ['http://[::ffff:169.254.169.254]/', 'IPv4-mapped metadata'],
  ['http://[::ffff:a9fe:a9fe]/', 'IPv4-mapped metadata (hex)'],
  ['http://[::127.0.0.1]/', 'IPv4-compatible loopback'],
  ['http://[::7f00:1]/', 'IPv4-compatible loopback (hex)'],
  ['http://[::8.8.8.8]/', 'IPv4-compatible (deprecated even when public)'],
  ['http://[::ffff:0:7f00:1]/', 'IPv4-translated (SIIT)'],
  ['http://[64:ff9b::127.0.0.1]/', 'NAT64 loopback'],
  ['http://[64:ff9b::a00:1]/', 'NAT64 private'],
  ['http://[64:ff9b::a9fe:a9fe]/', 'NAT64 metadata'],
  ['http://[64:ff9b:1::1]/', 'local-use NAT64'],
  ['http://[2002:7f00:1::]/', '6to4 loopback'],
  ['http://[2002:a9fe:a9fe::1]/', '6to4 metadata'],
  ['http://[2002:c0a8:101::1]/', '6to4 private'],
  ['http://[2001::1]/', 'Teredo'],
  ['http://[2001:db8::1]/', 'documentation'],
  ['http://[3fff::1]/', 'documentation (RFC 9637)'],
  ['http://[fe80::1]/', 'link-local'],
  ['http://[febf::1]/', 'link-local upper edge'],
  ['http://[fec0::1]/', 'site-local'],
  ['http://[fc00::1]/', 'unique-local'],
  ['http://[fd00:ec2::254]/', 'AWS IPv6 metadata (ULA)'],
  ['http://[ff02::1]/', 'multicast'],
  ['http://[100::1]/', 'discard-only'],
  ['http://[5f00::1]/', 'outside global unicast'],
]

const ALLOWED = [
  'http://example.com/',
  'https://example.com./path?q=1',
  'https://sub.example.co.uk:8443/x',
  'http://93.184.216.34/',
  'http://8.8.8.8/',
  'http://172.32.0.1/',
  'http://100.128.0.1/',
  'http://[2606:2800:220:1:248:1893:25c8:1946]/',
  'http://[::ffff:93.184.216.34]/',
  'http://[2002:5db8:d822::1]/',
  'http://[64:ff9b::808:808]/',
  'https://xn--bcher-kva.example/',
  // names that spell out a PUBLIC address, or only look numeric, stay allowed
  'http://ec2-3-4-5-6.compute-1.amazonaws.com/',
  'http://1.1.1.1.example.com/',
  'http://release-2024-10-01-1.example.com/',
  'http://a1-2-3.example.com/',
]

describe('checkTarget: blocked hosts', () => {
  it.each(BLOCKED)('%s (%s) is refused with 403', url => {
    const r = checkTarget(url)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.status).toBe(403)
      expect(r.error).toMatch(/^blocked host/)
    }
  })

  it('blocks the same hosts whatever web port is named', () => {
    for (const url of ['http://127.0.0.1:8080/', 'http://[::1]:443/', 'http://169.254.169.254:80/', 'https://localhost:8443/']) {
      expect(checkTarget(url), url).toMatchObject({ ok: false, status: 403, error: expect.stringMatching(/^blocked host/) })
    }
  })
})

describe('checkTarget: ports', () => {
  it.each([22, 25, 3306, 6379, 9200, 11211, 8000, 3000, 1])('refuses port %i with 403', port => {
    expect(checkTarget(`http://example.com:${port}/`)).toMatchObject({ ok: false, status: 403, error: expect.stringMatching(/^blocked port/) })
  })

  it.each([
    'http://example.com:80/', 'https://example.com:443/', 'http://example.com:443/', 'https://example.com:8443/',
    'http://example.com:8080/', 'http://example.com:8880/', 'https://example.com:2053/',
  ])('allows the web port in %s', url => {
    expect(checkTarget(url)).toMatchObject({ ok: true })
  })
})

describe('checkTarget: public hosts', () => {
  it.each(ALLOWED)('%s is allowed', url => {
    const r = checkTarget(url)
    expect(r).toMatchObject({ ok: true })
  })
})

describe('checkTarget: malformed or unsupported URLs', () => {
  it.each([
    ['', 'empty'],
    ['   ', 'blank'],
    ['not a url', 'not a URL'],
    ['example.com', 'no scheme'],
    ['file:///etc/passwd', 'file scheme'],
    ['ftp://example.com/', 'ftp scheme'],
    ['gopher://example.com/', 'gopher scheme'],
    ['data:text/plain,hi', 'data scheme'],
    ['javascript:alert(1)', 'javascript scheme'],
    ['http://user:pass@example.com/', 'credentials'],
    ['http://user@example.com/', 'username only'],
    ['http://127.0.0.1:80@example.com/', 'credentials that look like a host'],
    ['http://example.com@127.0.0.1/', 'credentials in front of a loopback host'],
    ['http://1.2.3.4.5/', 'five-part IPv4'],
    ['http://[fe80::1%25eth0]/', 'IPv6 zone id'],
    [`http://example.com/${'a'.repeat(5000)}`, 'too long'],
  ])('%s (%s) is a 400', url => {
    const r = checkTarget(url)
    expect(r).toMatchObject({ ok: false, status: 400 })
  })

  it('refuses the deployment’s own host', () => {
    expect(checkTarget('https://stringutilitybelt.com/api/fetch?url=x', { selfHost: 'stringutilitybelt.com' }))
      .toMatchObject({ ok: false, status: 403 })
    expect(checkTarget('https://stringutilitybelt.com./', { selfHost: 'stringutilitybelt.com' }))
      .toMatchObject({ ok: false, status: 403 })
    expect(checkTarget('https://example.com/', { selfHost: 'stringutilitybelt.com' })).toMatchObject({ ok: true })
  })
})

describe('parsers', () => {
  it('parseIPv4 accepts every inet_aton spelling', () => {
    const loop = 0x7f000001
    for (const s of ['127.0.0.1', '127.1', '127.0.1', '2130706433', '0x7f000001', '0x7f.1', '017700000001', '0177.0.0.01', '127.0.0.1.']) {
      expect(parseIPv4(s), s).toBe(loop)
    }
    expect(parseIPv4('255.255.255.255')).toBe(0xffffffff)
    expect(parseIPv4('0x')).toBe(0)
  })

  it('parseIPv4 rejects non-addresses', () => {
    for (const s of ['256.0.0.1', '1.2.3.4.5', '4294967296', '08.0.0.1', 'example.com', '1.2.3.x', '', '.']) {
      expect(parseIPv4(s), s).toBeNull()
    }
  })

  it('parseIPv6 expands compressed forms and embedded IPv4', () => {
    expect(parseIPv6('::1')).toEqual([0, 0, 0, 0, 0, 0, 0, 1])
    expect(parseIPv6('::')).toEqual([0, 0, 0, 0, 0, 0, 0, 0])
    expect(parseIPv6('::ffff:127.0.0.1')).toEqual([0, 0, 0, 0, 0, 0xffff, 0x7f00, 1])
    expect(parseIPv6('2001:db8::8:800:200c:417a')).toEqual([0x2001, 0xdb8, 0, 0, 8, 0x800, 0x200c, 0x417a])
    expect(parseIPv6('1:2:3:4:5:6:7:8')).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
  })

  it('parseIPv6 rejects malformed input', () => {
    for (const s of ['1::2::3', '1:2:3:4:5:6:7:8:9', '12345::', 'fe80::1%eth0', '::ffff:256.0.0.1', 'g::1', '1:2:3:4:5:6:7']) {
      expect(parseIPv6(s), s).toBeNull()
    }
  })

  it('classifyHost treats numeric-looking junk as malformed, not as a name', () => {
    expect(classifyHost('1.2.3.4.5')).toBe('malformed IPv4 address')
    expect(classifyHost('foo.0x1')).toBe('malformed IPv4 address')
    expect(classifyHost('0x7g.1')).toBe('malformed IPv4 address')
    expect(classifyHost('1password.com')).toBeNull()
    expect(classifyHost('[::1]')).toBe('loopback address')
    expect(classifyHost('::1')).toBe('loopback address')
  })
})
