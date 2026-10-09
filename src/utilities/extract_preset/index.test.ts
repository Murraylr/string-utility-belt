import { describe, it, expect } from 'vitest'
import util from './index'

const run = (input: string, params: Record<string, unknown> = {}) =>
  util.apply(input, params) as Promise<string> | string

describe('extract_preset', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('extract_preset')
    expect(util.name).toBe('extract matches')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params)).toEqual(['type', 'unique', 'sort', 'separator', 'count'])
  })

  it('extracts urls by default', async () => {
    const text = 'Visit https://example.com/docs?a=1 and http://test.org.'
    expect(await run(text)).toBe('https://example.com/docs?a=1\nhttp://test.org')
    expect(await run(text, { type: 'urls' })).toBe('https://example.com/docs?a=1\nhttp://test.org')
  })

  it('returns empty string for empty input', async () => {
    expect(await run('')).toBe('')
    expect(await run('', { type: 'emails' })).toBe('')
    expect(await run('', { type: 'words', count: true })).toBe('0')
  })

  // every `type` option, exercised once each
  const cases: Array<[string, string, string[]]> = [
    ['urls', 'see https://a.example/x?q=1 and www.b.org/page.', ['https://a.example/x?q=1', 'www.b.org/page']],
    ['emails', 'Contact ada@example.com or bob.smith+tag@mail.co.uk.', ['ada@example.com', 'bob.smith+tag@mail.co.uk']],
    ['ipv4', 'route from 192.168.1.10 to 8.8.8.8 now', ['192.168.1.10', '8.8.8.8']],
    ['ipv6', 'host 2001:0db8:85a3:0000:0000:8a2e:0370:7334 and ::1 up', ['2001:0db8:85a3:0000:0000:8a2e:0370:7334', '::1']],
    ['numbers', 'price 42 then -3.14 then 1,234.50', ['42', '-3.14', '1,234.50']],
    ['integers', 'a 42 b -7 c 3.14 d', ['42', '-7']],
    ['hashtags', 'love #TypeScript and #café and #100days', ['#TypeScript', '#café', '#100days']],
    ['mentions', 'cc @ada and @bob_dev, not ada@example.com', ['@ada', '@bob_dev']],
    ['hex-colors', 'bg #FF8800 fg #fff overlay #ff8800aa', ['#FF8800', '#fff', '#ff8800aa']],
    ['uuids', 'id=550e8400-e29b-41d4-a716-446655440000;', ['550e8400-e29b-41d4-a716-446655440000']],
    ['quoted-strings', 'He said "hello there" and \'bye\' softly', ['hello there', 'bye']],
    ['dates', 'on 2024-03-01 and 15/04/2023 and March 3, 2021', ['2024-03-01', '15/04/2023', 'March 3, 2021']],
    ['times', 'at 09:30 and 14:05:59 and 7 pm', ['09:30', '14:05:59', '7 pm']],
    ['phone', 'call +1 (555) 123-4567 or 555-123-4567', ['+1 (555) 123-4567', '555-123-4567']],
    ['html-tags', '<p class="x">hi</p><!-- note -->', ['<p class="x">', '</p>', '<!-- note -->']],
    ['words', "Hello, world — naïve don't", ['Hello', 'world', 'naïve', "don't"]],
    ['domains', 'go to example.com and sub.test.co.uk today', ['example.com', 'sub.test.co.uk']],
    ['file-paths', 'see /usr/local/bin and C:\\Users\\me\\file.txt and ./src/index.ts', ['/usr/local/bin', 'C:\\Users\\me\\file.txt', './src/index.ts']],
    ['credit-cards', 'card 4111 1111 1111 1111 exp 12/29', ['4111 1111 1111 1111']],
    ['jwt', 'token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc123 here', ['eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc123']]
  ]

  it.each(cases)('extracts %s', async (type, input, expected) => {
    expect(await run(input, { type })).toBe(expected.join('\n'))
  })

  it('keeps the whole ipv6 address, compressed or ipv4-mapped', async () => {
    expect(await run('host 2001:db8::1 up', { type: 'ipv6' })).toBe('2001:db8::1')
    expect(await run('link fe80::abc:1 and fe80:: down', { type: 'ipv6' })).toBe('fe80::abc:1\nfe80::')
    expect(await run('x ::ffff:192.168.1.1 y', { type: 'ipv6' })).toBe('::ffff:192.168.1.1')
    expect(await run('0:0:0:0:0:ffff:1.2.3.4', { type: 'ipv6' })).toBe('0:0:0:0:0:ffff:1.2.3.4')
    expect(await run('use 2001:DB8::AB.', { type: 'ipv6' })).toBe('2001:DB8::AB')
    expect(await run('http://[2001:db8::1]:8080/', { type: 'ipv6' })).toBe('2001:db8::1')
  })

  it('does not mistake scope operators, macs or clock times for ipv6', async () => {
    expect(await run('std::vector<int> at 12:30', { type: 'ipv6' })).toBe('')
    expect(await run('mac 00:1A:2B:3C:4D:5E', { type: 'ipv6' })).toBe('')
    expect(await run('1:2:3:4:5:6:7:8:9', { type: 'ipv6' })).toBe('')
  })

  it('finds the date inside an iso timestamp', async () => {
    expect(await run('logged 2024-03-01T10:00:00Z ok', { type: 'dates' })).toBe('2024-03-01')
    expect(await run('logged 2024-03-01T10:00:00Z ok', { type: 'times' })).toBe('10:00:00Z')
    expect(await run('1.2.3.4 and 192.168.1.1', { type: 'dates' })).toBe('')
    expect(await run('due 2024/03/01 and 2024.03.01', { type: 'dates' })).toBe('2024/03/01\n2024.03.01')
    expect(await run('runtime 90:00 but 1:30:00 counts', { type: 'times' })).toBe('1:30:00')
  })

  it('keeps a > inside an html attribute value inside the tag', async () => {
    expect(await run('<a title="a>b">z</a>', { type: 'html-tags' })).toBe('<a title="a>b">\n</a>')
    expect(await run('<img src=x alt=\'a>b\' /> end', { type: 'html-tags' })).toBe("<img src=x alt='a>b' />")
    expect(await run('5 < 7 and a > b', { type: 'html-tags' })).toBe('')
  })

  it('deduplicates with unique', async () => {
    const text = 'a@x.com b@x.com a@x.com'
    expect(await run(text, { type: 'emails' })).toBe('a@x.com\nb@x.com\na@x.com')
    expect(await run(text, { type: 'emails', unique: true })).toBe('a@x.com\nb@x.com')
  })

  it('sorts alphabetically, and numerically for number types', async () => {
    expect(await run('zeta.com beta.com', { type: 'domains', sort: true })).toBe('beta.com\nzeta.com')
    expect(await run('10 9 100', { type: 'integers', sort: true })).toBe('9\n10\n100')
  })

  it('honours the separator, including escape sequences', async () => {
    expect(await run('a@x.com b@x.com', { type: 'emails', separator: ', ' })).toBe('a@x.com, b@x.com')
    expect(await run('a@x.com b@x.com', { type: 'emails', separator: '\\t' })).toBe('a@x.com\tb@x.com')
  })

  it('returns only the count when count is set', async () => {
    expect(await run('one @a two @b three @a', { type: 'mentions', count: true })).toBe('3')
    expect(await run('one @a two @b three @a', { type: 'mentions', count: true, unique: true })).toBe('2')
  })

  it('handles non-ascii text without splitting characters', async () => {
    expect(await run('日本語 の テキスト 🎉 done', { type: 'words' })).toBe('日本語\nの\nテキスト\ndone')
    expect(await run('mail 田中@example.jp ok', { type: 'domains' })).toBe('example.jp')
  })

  it('rejects an unknown type', async () => {
    await expect(async () => run('x', { type: 'bogus' })).rejects.toThrow(/unknown extract type/)
    await expect(async () => run('x', { type: 42 })).rejects.toThrow(/unknown extract type/)
  })

  it('filters credit cards by luhn checksum', async () => {
    expect(await run('4111 1111 1111 1112', { type: 'credit-cards' })).toBe('')
    expect(await run('numbers 1234 5678 9012 3456 here', { type: 'credit-cards' })).toBe('')
  })

  it('accepts a legacy single-string type value', async () => {
    const text = 'Visit https://example.com and http://test.org today'
    expect(await run(text, { type: 'urls' })).toBe('https://example.com\nhttp://test.org')
  })

  it('extracts several types at once, merged in order of appearance', async () => {
    const text = 'Email ada@example.com or call 555-123-4567'
    expect(await run(text, { type: ['emails', 'phone'] })).toBe('ada@example.com\n555-123-4567')
    // Order in the text wins even when the type array lists them the other way round.
    expect(await run(text, { type: ['phone', 'emails'] })).toBe('ada@example.com\n555-123-4567')
  })

  it('applies unique, sort and count across a multiselect', async () => {
    const text = 'call @a then @a then visit a.com then b.com then @a'
    expect(await run(text, { type: ['mentions', 'domains'], unique: true })).toBe('@a\na.com\nb.com')
    expect(await run(text, { type: ['mentions', 'domains'], count: true })).toBe('5')
  })

  it('rejects an empty type array', async () => {
    await expect(async () => run('x', { type: [] })).rejects.toThrow(/select at least one type/)
  })

  it('rejects an unknown type inside a multiselect', async () => {
    await expect(async () => run('x', { type: ['urls', 'bogus'] })).rejects.toThrow(/unknown extract type/)
  })

  it('scans html tags in linear time when a tag never closes', async () => {
    expect(await run(`<a${'\t\t!='.repeat(5000)}" <b x= y>`, { type: 'html-tags' })).toBe('<b x= y>')
  })
})
