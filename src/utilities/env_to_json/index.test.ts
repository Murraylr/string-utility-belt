import { describe, it, expect } from 'vitest'
import util from './index'
import toEnv from '../json_to_env/index'

const parse = async (input: string, params: Record<string, unknown> = {}) =>
  JSON.parse(String(await util.apply(input, params)))

describe('env_to_json', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('env_to_json')
    expect(util.name).toBe('.env to json')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['expand', 'indent', 'typed'])
  })

  it('parses KEY=value pairs', async () => {
    expect(await parse('PORT=3000\nDEBUG=true')).toEqual({ PORT: '3000', DEBUG: 'true' })
    expect(await parse('EMPTY=')).toEqual({ EMPTY: '' })
    expect(await parse('A=1\nA=2')).toEqual({ A: '2' })
  })

  it('returns an empty object for empty input', async () => {
    expect(await util.apply('', {})).toBe('{}')
    expect(await util.apply('\n\n   \n', {})).toBe('{}')
    expect(await util.apply('# only a comment', {})).toBe('{}')
  })

  it('handles comments, blank lines and export prefixes', async () => {
    const env = ['# leading comment', '', 'export API_KEY=abc123', 'PORT = 8080 # inline comment'].join(
      '\n'
    )
    expect(await parse(env)).toEqual({ API_KEY: 'abc123', PORT: '8080' })
    expect(await parse('URL=http://x.dev/#frag')).toEqual({ URL: 'http://x.dev/#frag' })
  })

  it('understands single, double and backtick quoting', async () => {
    const env = ['A="x y"', "B='$literal'", 'C=`tick`'].join('\n')
    expect(await parse(env)).toEqual({ A: 'x y', B: '$literal', C: 'tick' })
    expect(await parse('A="line1\\nline2\\tend"')).toEqual({ A: 'line1\nline2\tend' })
    expect(await parse('A="say \\"hi\\""')).toEqual({ A: 'say "hi"' })
    expect(await parse('A="\\$5"')).toEqual({ A: '$5' })
  })

  it('reads multi-line quoted values', async () => {
    expect(await parse('KEY="first\nsecond"\nNEXT=ok')).toEqual({ KEY: 'first\nsecond', NEXT: 'ok' })
  })

  it('coerces values only when typed is on', async () => {
    const env = 'N=42\nF=1.5\nB=true\nNIL=null\nS="42"\nZ=007'
    expect(await parse(env)).toEqual({ N: '42', F: '1.5', B: 'true', NIL: 'null', S: '42', Z: '007' })
    expect(await parse(env, { typed: true })).toEqual({
      N: 42,
      F: 1.5,
      B: true,
      NIL: null,
      S: '42',
      Z: '007'
    })
  })

  it('does not lose digits when typing long integers', async () => {
    expect(await parse('ID=9007199254740993\nN=1e3\nBIG=12345678901234567890', { typed: true })).toEqual({
      ID: '9007199254740993',
      N: 1000,
      BIG: '12345678901234567890'
    })
  })

  it('treats prototype key names as plain data', async () => {
    expect(await util.apply('__proto__=x\nA=1', { indent: 0 })).toBe('{"__proto__":"x","A":"1"}')
    expect(await util.apply('constructor=1\ntoString=2', { indent: 0 })).toBe(
      '{"constructor":"1","toString":"2"}'
    )
    expect(await util.apply('__proto__=x\nA=${__proto__}', { indent: 0, expand: true })).toBe(
      '{"__proto__":"x","A":"x"}'
    )
  })

  it('expands ${VAR} references only when expand is on', async () => {
    const env = [
      'HOST=example.com',
      'URL=https://${HOST}/api',
      'BARE=$HOST',
      "LIT='${HOST}'",
      'MISS=${NOPE:-fallback}'
    ].join('\n')
    expect(await parse(env, { expand: true })).toEqual({
      HOST: 'example.com',
      URL: 'https://example.com/api',
      BARE: 'example.com',
      LIT: '${HOST}',
      MISS: 'fallback'
    })
    expect(await parse(env, { expand: false })).toEqual({
      HOST: 'example.com',
      URL: 'https://${HOST}/api',
      BARE: '$HOST',
      LIT: '${HOST}',
      MISS: '${NOPE:-fallback}'
    })
  })

  it('honours the indent parameter', async () => {
    expect(await util.apply('A=1', { indent: 0 })).toBe('{"A":"1"}')
    expect(await util.apply('A=1', { indent: 2 })).toBe('{\n  "A": "1"\n}')
    expect(await util.apply('A=1', { indent: 4 })).toBe('{\n    "A": "1"\n}')
  })

  it('preserves non-ascii and astral characters', async () => {
    expect(await parse('MSG="héllo 🙂"\nEMOJI=🙂')).toEqual({ MSG: 'héllo 🙂', EMOJI: '🙂' })
    expect(await parse('A="\\u{1F642}\\u00e9"')).toEqual({ A: '🙂é' })
  })

  it('round-trips with json_to_env, unicode included', async () => {
    const original = { GREETING: 'héllo 🙂', PROMPT: 'cost: $5', PATH_LIST: 'a:b', EMPTY: '' }
    const env = String(await toEnv.apply(JSON.stringify(original), { upperCase: false }))
    expect(await parse(env)).toEqual(original)
  })

  it('throws on malformed input', () => {
    expect(() => util.apply('JUSTAKEY', {})).toThrow(/expected KEY=value/)
    expect(() => util.apply('A="unterminated', {})).toThrow(/unterminated/)
    expect(() => util.apply('A=${B}\nB=${A}', { expand: true })).toThrow(/circular/)
  })
})
