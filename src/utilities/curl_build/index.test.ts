import { describe, it, expect } from 'vitest'
import util from './index'
import parseUtil from '../curl_parse/index'

const run = async (input: unknown, params: Record<string, unknown> = {}) =>
  (await util.apply(input as any, params)) as string

const REQ = {
  method: 'POST',
  url: 'https://api.example.com/items',
  headers: { 'Content-Type': 'application/json' },
  body: '{"a":1}'
}

describe('curl_build', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('curl_build')
    expect(util.name).toBe('json to curl command')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('json')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['flavor', 'multiline', 'pretty'])
  })

  it('builds a single-line posix command', async () => {
    expect(await run(REQ, { multiline: false, pretty: false })).toBe(
      `curl -X POST 'https://api.example.com/items' -H 'Content-Type: application/json' --data-raw '{"a":1}'`
    )
  })

  it('breaks the command across lines when multiline is on', async () => {
    expect(await run(REQ, { pretty: false })).toBe(
      [
        `curl -X POST 'https://api.example.com/items' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  --data-raw '{"a":1}'`
      ].join('\n')
    )
  })

  it('pretty-prints a json body only when pretty is on', async () => {
    expect(await run(REQ, { multiline: false, pretty: true })).toContain(`--data-raw '{\n  "a": 1\n}'`)
    expect(await run({ ...REQ, body: 'not json at all' }, { multiline: false, pretty: true })).toContain(
      `--data-raw 'not json at all'`
    )
  })

  it('uses curl.exe, double quotes and backtick continuations for powershell', async () => {
    const single = await run(REQ, { multiline: false, pretty: false, flavor: 'powershell' })
    expect(single).toBe(
      'curl.exe -X POST "https://api.example.com/items" -H "Content-Type: application/json" --data-raw "{`"a`":1}"'
    )
    expect(await run(REQ, { pretty: false, flavor: 'powershell' })).toContain(' `\n  ')
  })

  it('escapes embedded quotes and emits auth, flags and form fields', async () => {
    expect(await run({ url: 'https://x.test', body: "it's fine" }, { multiline: false, pretty: false })).toBe(
      `curl 'https://x.test' --data-raw 'it'\\''s fine'`
    )
    expect(
      await run(
        {
          url: 'https://x.test',
          auth: { user: 'alice', password: 's3cret' },
          flags: { compressed: true, insecure: true, location: true, get: true, silent: true, 'max-time': 30 }
        },
        { multiline: false }
      )
    ).toBe(`curl 'https://x.test' -u 'alice:s3cret' --compressed -k -L -G --silent --max-time '30'`)
    expect(await run({ url: 'https://x.test', form: [{ name: 'file', value: '@a.png' }] }, { multiline: false })).toBe(
      `curl 'https://x.test' -F 'file=@a.png'`
    )
  })

  it('emits -I for HEAD rather than the hanging -X HEAD', async () => {
    expect(await run({ method: 'HEAD', url: 'https://x.test', flags: { head: true } }, { multiline: false })).toBe(
      `curl -I 'https://x.test'`
    )
    const roundTripped = await parseUtil.apply(`curl -I 'https://x.test'`, {})
    expect(await run(roundTripped, { multiline: false })).toBe(`curl -I 'https://x.test'`)
  })

  it('keeps a text form field from being read as a file, and maps cookie-file to -b', async () => {
    expect(
      await run(
        { url: 'https://x.test', form: [{ name: 'a', value: '@literal', type: 'text' }, { name: 'b', value: '@up.png', type: 'file' }] },
        { multiline: false }
      )
    ).toBe(`curl 'https://x.test' --form-string 'a=@literal' -F 'b=@up.png'`)

    // curl_parse records `-b cookies.txt` as flags["cookie-file"]; --cookie-file is not a curl flag
    expect(await run({ url: 'https://x.test', flags: { 'cookie-file': 'cookies.txt' } }, { multiline: false })).toBe(
      `curl 'https://x.test' -b 'cookies.txt'`
    )
  })

  it('handles non-ASCII values', async () => {
    expect(
      await run({ url: 'https://x.test/☕', headers: { 'X-Title': 'café 😀' } }, { multiline: false })
    ).toBe(`curl 'https://x.test/☕' -H 'X-Title: café 😀'`)
  })

  it('returns empty output for empty input', async () => {
    expect(await run('')).toBe('')
    expect(await run({})).toBe('')
  })

  it('throws without a url and on non-JSON input', async () => {
    expect(() => util.apply({ method: 'GET' } as any, {})).toThrow(/needs a "url"/)
    expect(() => util.apply('definitely not json' as any, {})).toThrow(/expected JSON/)
    expect(() => util.apply({ url: 'https://x.test', headers: { 'X-A': 'a\nb' } } as any, {})).toThrow(/line breaks/)
  })

  it('round-trips with curl_parse in both flavors, including unicode', async () => {
    const request = {
      method: 'POST',
      url: 'https://api.example.com/v1/items?q=café',
      headers: { 'Content-Type': 'application/json', 'X-Emoji': '😀', Cookie: 'sid=42' },
      body: '{"name":"café ☕"}',
      auth: { user: 'alice', password: 's3:cret' },
      flags: { compressed: true, insecure: false, location: true, get: false }
    }

    for (const flavor of ['posix', 'powershell']) {
      const cmd = await run(request, { flavor, pretty: false })
      expect(await parseUtil.apply(cmd, {})).toEqual(request)
    }

    const original = `curl -X PATCH 'https://x.test/it%27s' -H 'X-Q: a"b' --data-raw 'a=1&b=2'`
    const reparsed = await parseUtil.apply(original, {})
    expect(await run(reparsed, { multiline: false, pretty: false })).toBe(original)
  })
})
