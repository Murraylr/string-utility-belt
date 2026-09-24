import { describe, it, expect } from 'vitest'
import util from './index'

describe('json_to_env', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('json_to_env')
    expect(util.name).toBe('json to .env')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual([
      'delimiter',
      'exportPrefix',
      'quote',
      'upperCase'
    ])
  })

  it('writes KEY=value lines for a flat object', async () => {
    expect(await util.apply('{"port":3000,"debug":true}', {})).toBe('PORT=3000\nDEBUG=true')
    expect(await util.apply('{"empty":null}', {})).toBe('EMPTY=')
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('  ', {})).toBe('')
    expect(await util.apply('{}', {})).toBe('')
  })

  it('flattens nested objects and arrays with the delimiter', async () => {
    const json = '{"db":{"host":"localhost","port":5432},"tags":["a","b"]}'
    expect(await util.apply(json, {})).toBe('DB_HOST=localhost\nDB_PORT=5432\nTAGS_0=a\nTAGS_1=b')
    expect(await util.apply(json, { delimiter: '__' })).toBe(
      'DB__HOST=localhost\nDB__PORT=5432\nTAGS__0=a\nTAGS__1=b'
    )
    expect(await util.apply('{"db":{"host":"x"}}', { upperCase: false })).toBe('db_host=x')
  })

  it('supports every quoting mode', async () => {
    expect(await util.apply('{"a":"b c"}', { quote: 'auto' })).toBe('A="b c"')
    expect(await util.apply('{"a":"plain"}', { quote: 'auto' })).toBe('A=plain')
    expect(await util.apply('{"a":"plain"}', { quote: 'always' })).toBe('A="plain"')
    expect(await util.apply('{"a":"b c"}', { quote: 'never' })).toBe('A=b c')
    expect(await util.apply('{"a":"x\\ny"}', { quote: 'never' })).toBe('A=x\\ny')
    expect(await util.apply('{"a":"x\\ny"}', { quote: 'auto' })).toBe('A="x\\ny"')
    expect(await util.apply('{"a":"say \\"hi\\""}', {})).toBe('A="say \\"hi\\""')
  })

  it('quotes values that would otherwise change meaning', async () => {
    expect(await util.apply('{"a":"has # hash"}', {})).toBe('A="has # hash"')
    expect(await util.apply('{"a":"  padded  "}', {})).toBe('A="  padded  "')
    expect(await util.apply('{"a":"back`tick"}', {})).toBe('A="back`tick"')
  })

  it('keeps shell metacharacters literal with single quotes', async () => {
    expect(await util.apply('{"cmd":"echo $HOME"}', {})).toBe("CMD='echo $HOME'")
    expect(await util.apply('{"win":"C:\\\\tmp"}', {})).toBe("WIN='C:\\tmp'")
  })

  it('adds the export prefix when asked', async () => {
    expect(await util.apply('{"a":"1"}', { exportPrefix: true })).toBe('export A=1')
    expect(await util.apply('{"a":"1"}', { exportPrefix: false })).toBe('A=1')
  })

  it('preserves non-ascii and astral characters in values', async () => {
    expect(await util.apply('{"msg":"héllo 🙂"}', {})).toBe('MSG="héllo 🙂"')
    expect(await util.apply('{"café":"crème"}', {})).toBe('CAFÉ=crème')
  })

  it('sanitises characters that are illegal in key names', async () => {
    expect(await util.apply('{"my key-name":"1"}', {})).toBe('MY_KEY_NAME=1')
  })

  it('throws on invalid or unsupported input', () => {
    expect(() => util.apply('{oops', {})).toThrow(/invalid JSON/)
    expect(() => util.apply('["a"]', {})).toThrow(/JSON object/)
    expect(() => util.apply('"scalar"', {})).toThrow(/JSON object/)
  })
})
