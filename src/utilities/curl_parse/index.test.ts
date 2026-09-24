import { describe, it, expect } from 'vitest'
import util from './index'

const run = async (input: string) => (await util.apply(input, {})) as Record<string, any>

const CMD = `curl 'https://api.example.com/v1/items?page=2' \\
  -X POST \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer abc123' \\
  --data-raw '{"name":"café ☕"}' \\
  --compressed`

describe('curl_parse', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('curl_parse')
    expect(util.name).toBe('curl command to json')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('json')
    expect(util.params).toEqual({})
  })

  it('parses a realistic multi-line command', async () => {
    const out = await run(CMD)
    expect(out.method).toBe('POST')
    expect(out.url).toBe('https://api.example.com/v1/items?page=2')
    expect(out.headers).toEqual({
      'Content-Type': 'application/json',
      Authorization: 'Bearer abc123'
    })
    expect(out.body).toBe('{"name":"café ☕"}')
    expect(out.auth).toBeNull()
    expect(out.flags).toEqual({ compressed: true, insecure: false, location: false, get: false })
  })

  it('handles double quotes, backslash escapes and $\'...\' quoting', async () => {
    const dq = await run('curl "https://x.test" -d "{\\"a\\":1}"')
    expect(dq.body).toBe('{"a":1}')
    expect(dq.method).toBe('POST')

    const ansi = await run("curl 'https://x.test' --data-binary $'line1\\nline2\\u00e9\\U0001F600'")
    expect(ansi.body).toBe('line1\nline2é😀')
    expect((await run("curl 'https://x.test' -d $'\\u{1F600}'")).body).toBe('😀')
    // \nnn is octal in bash: \012 is LF, and \0 alone is NUL
    expect((await run("curl 'https://x.test' -d $'a\\012b\\0'")).body).toBe('a\nb\0')

    const ps = await run('curl.exe "https://x.test" `\n  -H "X-Note: say ""hi"""')
    expect(ps.url).toBe('https://x.test')
    expect(ps.headers['X-Note']).toBe('say hi')
  })

  it('reads auth, cookie, user-agent and referer flags', async () => {
    const out = await run(
      "curl 'https://x.test' -u 'alice:s3cret' -A 'my-agent/1.0' -e 'https://ref.test' -b 'sid=42'"
    )
    expect(out.auth).toEqual({ user: 'alice', password: 's3cret' })
    expect(out.headers).toEqual({
      'User-Agent': 'my-agent/1.0',
      Referer: 'https://ref.test',
      Cookie: 'sid=42'
    })
  })

  it('expands bundled short flags and keeps -G a GET', async () => {
    const bundled = await run('curl -skL https://x.test')
    expect(bundled.flags.insecure).toBe(true)
    expect(bundled.flags.location).toBe(true)
    expect(bundled.flags.silent).toBe(true)
    expect(bundled.url).toBe('https://x.test')

    const get = await run("curl -G 'https://x.test' -d 'q=1' -d 'p=2'")
    expect(get.method).toBe('GET')
    expect(get.flags.get).toBe(true)
    expect(get.body).toBe('q=1&p=2')
  })

  it('reads --url, --request and inline flag values', async () => {
    const long = await run("curl --url 'https://x.test/a' --request patch --data 'k=v'")
    expect(long.url).toBe('https://x.test/a')
    expect(long.method).toBe('PATCH')
    expect(long.body).toBe('k=v')

    const inline = await run("curl --url='https://x.test/b' -XPUT")
    expect(inline.url).toBe('https://x.test/b')
    expect(inline.method).toBe('PUT')
  })

  it('picks the url-shaped argument even after an unrecognised value flag', async () => {
    // --max-filesize is not modelled, so its value lands in the positional list
    const out = await run('curl --max-filesize 1000 https://x.test/late')
    expect(out.url).toBe('https://x.test/late')
    expect((await run('curl -s localhost:3000/api')).url).toBe('localhost:3000/api')
    expect((await run('curl example.com')).url).toBe('example.com')
  })

  it('accepts HTTP/2 pseudo-headers from -H', async () => {
    const out = await run("curl 'https://x.test' -H ':authority: api.test' -H ':path: /v1'")
    expect(out.headers).toEqual({ ':authority': 'api.test', ':path': '/v1' })
  })

  it('url-encodes --data-urlencode and collects -F form fields', async () => {
    const enc = await run("curl 'https://x.test' --data-urlencode 'q=a b&c' --data-urlencode 'plain ☕'")
    expect(enc.body).toBe('q=a%20b%26c&plain%20%E2%98%95')

    // curl only leaves the RFC 3986 unreserved set alone — !'()* are escaped too
    const specials = await run(`curl 'https://x.test' --data-urlencode "q=a!b'c(d)e*f+g~h-i.j_k"`)
    expect(specials.body).toBe('q=a%21b%27c%28d%29e%2Af%2Bg~h-i.j_k')

    const form = await run("curl 'https://x.test' -F 'file=@a.png' -F 'name=bob'")
    expect(form.method).toBe('POST')
    expect(form.form).toEqual([
      { name: 'file', value: '@a.png', type: 'file' },
      { name: 'name', value: 'bob', type: 'text' }
    ])
  })

  it('infers HEAD and PUT, and folds repeated headers', async () => {
    expect((await run('curl -I https://x.test')).method).toBe('HEAD')
    expect((await run("curl -T 'file.txt' https://x.test")).method).toBe('PUT')
    const dup = await run("curl 'https://x.test' -H 'X-A: 1' -H 'X-A: 2'")
    expect(dup.headers['X-A']).toEqual(['1', '2'])
  })

  it('returns an empty request for empty input', async () => {
    expect(await util.apply('', {})).toEqual({
      method: 'GET',
      url: '',
      headers: {},
      body: '',
      auth: null,
      flags: { compressed: false, insecure: false, location: false, get: false }
    })
  })

  it('throws on non-curl input, unterminated quotes and missing flag values', async () => {
    expect(() => util.apply('wget https://x.test', {})).toThrow(/not a curl command/)
    expect(() => util.apply("curl 'https://x.test", {})).toThrow(/unterminated single quote/)
    expect(() => util.apply('curl "https://x.test', {})).toThrow(/unterminated double quote/)
    expect(() => util.apply("curl 'https://x.test' -H", {})).toThrow(/requires a value/)
    expect(() => util.apply("curl 'https://x.test' -H 'no-colon-here'", {})).toThrow(/malformed -H header/)
    expect(() => util.apply("curl 'https://x.test' -H ': novalue'", {})).toThrow(/malformed -H header/)
    expect(() => util.apply("curl 'https://x.test' -H 'Bad Name: v'", {})).toThrow(/invalid header name/)
  })
})
