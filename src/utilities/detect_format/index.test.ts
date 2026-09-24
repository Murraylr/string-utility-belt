import { describe, it, expect } from 'vitest'
import util from './index'

type Detection = { format: string; confidence: number; note: string }

const run = async (input: unknown) => (await util.apply(input as never, {})) as unknown as Detection[]
const top = (list: Detection[]) => list[0]?.format
const score = (list: Detection[], format: string) => list.find((d) => d.format === format)?.confidence ?? 0
const formats = (list: Detection[]) => list.map((d) => d.format)

describe('detect_format', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('detect_format')
    expect(util.name).toBe('detect format')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('json')
    expect(util.params).toEqual({})
  })

  it('returns a sorted array of well-formed candidates', async () => {
    const list = await run('{"a":1}')
    expect(Array.isArray(list)).toBe(true)
    expect(list.length).toBeGreaterThan(0)
    for (const d of list) {
      expect(typeof d.format).toBe('string')
      expect(typeof d.note).toBe('string')
      expect(d.confidence).toBeGreaterThan(0)
      expect(d.confidence).toBeLessThanOrEqual(1)
    }
    const confidences = list.map((d) => d.confidence)
    expect([...confidences].sort((a, b) => b - a)).toEqual(confidences)
  })

  it('recognises JSON and reports JSON5 as a superset', async () => {
    const list = await run('{"a":1,"b":[1,2]}')
    expect(top(list)).toBe('JSON')
    expect(score(list, 'JSON')).toBe(0.99)
    expect(list[0].note).toContain('2 keys')
    expect(formats(list)).toContain('JSON5')
    expect(top(await run('[1,2,3]'))).toBe('JSON')
  })

  it('recognises relaxed JSON5 that strict JSON rejects', async () => {
    const list = await run("{\n  // comment\n  a: 1,\n  b: 'two',\n}")
    expect(top(list)).toBe('JSON5')
    expect(score(list, 'JSON')).toBe(0)
    expect(list[0].note).toContain('comments')
  })

  it('recognises YAML, TOML, INI and .env', async () => {
    const yaml = await run('name: belt\nversion: 1.2.0\ntags:\n  - text\n  - tools\n')
    expect(top(yaml)).toBe('YAML')
    const toml = await run('[package]\nname = "belt"\nversion = "1.0.0"\nedition = 2021\n')
    expect(top(toml)).toBe('TOML')
    const ini = await run('[server]\nhost=localhost\nport=8080\n; a comment\n')
    expect(top(ini)).toBe('INI')
    const env = await run('DATABASE_URL=postgres://localhost/db\nAPI_KEY=abc123\nDEBUG=true\n')
    expect(top(env)).toBe('.env')
  })

  it('recognises XML and HTML', async () => {
    expect(top(await run('<?xml version="1.0"?><note><to>Tove</to></note>'))).toBe('XML')
    expect(top(await run('<note><to>Tove</to><from>Jani</from></note>'))).toBe('XML')
    const html = await run('<!DOCTYPE html><html><body><p>Hi</p></body></html>')
    expect(top(html)).toBe('HTML')
    expect(score(html, 'HTML')).toBeGreaterThan(0.9)
  })

  it('tells CSV from TSV', async () => {
    const csv = await run('name,age,city\nAda,36,London\nAlan,41,Manchester')
    expect(top(csv)).toBe('CSV')
    expect(csv[0].note).toContain('3 columns')
    const tsv = await run('name\tage\tcity\nAda\t36\tLondon\nAlan\t41\tManchester')
    expect(top(tsv)).toBe('TSV')
    expect(formats(tsv)).not.toContain('CSV')
  })

  it('recognises the base-N encodings', async () => {
    const b64 = await run('SGVsbG8sIFdvcmxkIQ==')
    expect(top(b64)).toBe('base64')
    expect(b64[0].note).toContain('Hello, World!')
    expect(top(await run('deadbeefcafebabe'))).toBe('hex')
    expect(top(await run('JBSWY3DPEHPK3PXP'))).toBe('base32')
    expect(top(await run('01001000 01101001'))).toBe('binary')
  })

  it('separates base64url from standard base64 by alphabet', async () => {
    // base64url of 'Hello, World!?~subject=1' — the '-' only exists in the url-safe alphabet.
    const urlSafe = await run('SGVsbG8sIFdvcmxkIT9-c3ViamVjdD0x')
    expect(top(urlSafe)).toBe('base64url')
    expect(urlSafe[0].note).toContain('Hello, World!?~subject=1')
    expect(formats(urlSafe)).not.toContain('base64')

    // '/++//g==' is standard-alphabet only: + and / are illegal in base64url.
    const standardOnly = await run('/++//g==')
    expect(top(standardOnly)).toBe('base64')
    expect(formats(standardOnly)).not.toContain('base64url')

    // Padding-free ASCII base64 really is valid under both alphabets.
    expect(formats(await run('SGVsbG8sIFdvcmxkIQ=='))).toContain('base64url')
  })

  it('does not read a UUID or a slug as a base64url payload', async () => {
    expect(formats(await run('550e8400-e29b-41d4-a716-446655440000'))).not.toContain('base64url')
    expect(score(await run('my-cool-slug_v2'), 'base64url')).toBeLessThan(0.5)
  })

  it('keeps astral characters whole in the decoded preview', async () => {
    // base64 of 39 'x' then U+1F600 then ' tail' — the 40-char preview cut lands on the emoji.
    const list = await run('eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh48J+YgCB0YWls')
    expect(top(list)).toBe('base64')
    expect(list[0].note).toContain(`${'x'.repeat(39)}\u{1F600}…`)
    expect(list[0].note).not.toMatch(/[\uD800-\uDFFF]/u)
  })

  it('reads zlib and base64-wrapped gzip streams', async () => {
    const zlib = await run(new Uint8Array([0x78, 0x9c, 0x03, 0x00]))
    expect(top(zlib)).toBe('zlib')
    expect(zlib[0].note).toContain('32768-byte window')
    expect(top(await run('H4sIAAAAAAAAA8tIzcnJVyjPL8pJAQCFEUoNCwAAAA=='))).toBe('gzip')
  })

  it('treats a lone key=value line as weak evidence of a config format', async () => {
    // Base64 padding makes any 'X==' look like an INI/TOML/.env assignment.
    const list = await run('SGVsbG8sIFdvcmxkIQ==')
    expect(top(list)).toBe('base64')
    for (const format of ['INI', 'TOML', '.env']) {
      expect(score(list, format)).toBeLessThanOrEqual(0.4)
    }
  })

  it('recognises token-shaped inputs', async () => {
    const jwt = await run(
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'
    )
    expect(top(jwt)).toBe('JWT')
    expect(jwt[0].note).toContain('alg=HS256')
    const uuid = await run('550e8400-e29b-41d4-a716-446655440000')
    expect(top(uuid)).toBe('UUID')
    expect(uuid[0].note).toContain('version 4')
    expect(top(await run('data:text/plain;base64,SGVsbG8='))).toBe('data URI')
    expect(top(await run('name=John%20Doe&city=New%20York'))).toBe('URL-encoded')
  })

  it('recognises identifiers on the web: email, url, ip, timestamp', async () => {
    expect(top(await run('ada@example.com'))).toBe('email')
    expect(top(await run('https://example.com/path?q=1#frag'))).toBe('URL')
    expect(top(await run('192.168.1.1'))).toBe('IP address')
    expect(top(await run('2001:db8::1'))).toBe('IP address')
    const ts = await run('1700000000')
    expect(top(ts)).toBe('unix timestamp (seconds)')
    expect(ts[0].note).toContain('2023-11-14')
  })

  it('recognises Markdown, SQL and Morse code', async () => {
    const md = await run('# Title\n\nSome **bold** text and a [link](https://example.com).\n\n- one\n- two\n')
    expect(top(md)).toBe('Markdown')
    expect(md[0].note).toContain('headings')
    const sql = await run('SELECT id, name FROM users WHERE age > 30;')
    expect(top(sql)).toBe('SQL')
    expect(top(await run('.... . .-.. .-.. ---'))).toBe('Morse code')
  })

  it('spots gzip magic bytes and rot13 text', async () => {
    const gz = await run(new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00]))
    expect(top(gz)).toBe('gzip')
    expect(gz[0].confidence).toBe(0.99)
    const rot = await run('Uryyb jbeyq, guvf vf n frperg zrffntr')
    expect(top(rot)).toBe('ROT13')
    expect(rot[0].note).toContain('common English words')
  })

  it('returns an empty list for empty input', async () => {
    expect(await run('')).toEqual([])
  })

  it('falls back to plain text for unicode prose', async () => {
    const list = await run('\u3053\u3093\u306B\u3061\u306F\u3001\u4E16\u754C')
    expect(top(list)).toBe('plain text')
    expect(list[0].note).toContain('nothing structured')
  })

  it('never throws on malformed or hostile input', async () => {
    const inputs = ['{"a": 1,', '<<<>>>', '%%%%', ' ', '   ', 'data:', '=====', '{[}]']
    for (const bad of inputs) {
      const list = await run(bad)
      expect(Array.isArray(list)).toBe(true)
      for (const d of list) {
        expect(typeof d.format).toBe('string')
        expect(d.confidence).toBeGreaterThan(0)
        expect(d.confidence).toBeLessThanOrEqual(1)
      }
    }
    expect(Array.isArray(await run(new Uint8Array([0xff, 0xfe, 0x00])))).toBe(true)
  })
})
