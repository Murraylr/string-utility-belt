// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { staticRegistry } from '../../../src/utilities/static-registry'
import { coerceParamValue, parseStepSpec, splitOnCommas, splitParamTokens, UsageError } from './steps'

describe('splitParamTokens', () => {
  it('splits on plain commas', () => {
    expect(splitParamTokens('a=1,b=2,c')).toEqual(['a=1', 'b=2', 'c'])
  })

  it('keeps an escaped comma (as written) inside its token', () => {
    expect(splitParamTokens('a=x\\,y,b=2')).toEqual(['a=x\\,y', 'b=2'])
  })

  it('takes a JSON value whole', () => {
    expect(splitParamTokens('rules=[["a,b","c"],["d","e"]],trim=true')).toEqual([
      'rules=[["a,b","c"],["d","e"]]', 'trim=true',
    ])
    expect(splitParamTokens('obj={"a":1,"b":"]"},x=1')).toEqual(['obj={"a":1,"b":"]"}', 'x=1'])
  })

  it('does not treat quotes or unbalanced brackets as grouping', () => {
    expect(splitParamTokens("find=don't,replace=do not")).toEqual(["find=don't", 'replace=do not'])
    expect(splitParamTokens('a="x,y",b=2')).toEqual(['a="x', 'y"', 'b=2'])
    expect(splitParamTokens('text=[,b=2')).toEqual(['text=[', 'b=2'])
    expect(splitParamTokens('text={x,b=2')).toEqual(['text={x', 'b=2'])
  })

  it('only looks for JSON right after the first =', () => {
    expect(splitParamTokens('p=a[,]b,q=1')).toEqual(['p=a[', ']b', 'q=1'])
  })

  it('returns a single empty-string element for an empty input', () => {
    expect(splitParamTokens('')).toEqual([''])
  })
})

describe('splitOnCommas', () => {
  it('splits on unescaped commas, keeping escapes for the caller', () => {
    expect(splitOnCommas('a\\,b,c')).toEqual(['a\\,b', 'c'])
  })
})

describe('coerceParamValue', () => {
  it('converts number and range params', () => {
    expect(coerceParamValue({ kind: 'number', label: 'n' }, '42', 'n', 'u')).toBe(42)
    expect(coerceParamValue({ kind: 'range', label: 'n', min: 0, max: 10 }, '3.5', 'n', 'u')).toBe(3.5)
  })

  it('rejects a non-numeric number value', () => {
    expect(() => coerceParamValue({ kind: 'number', label: 'n' }, 'abc', 'n', 'u')).toThrow(UsageError)
    expect(() => coerceParamValue({ kind: 'number', label: 'n' }, '', 'n', 'u')).toThrow(/must be a number/)
  })

  it('converts boolean params from several spellings', () => {
    const spec = { kind: 'boolean' as const, label: 'b' }
    for (const v of ['true', 'TRUE', '1', 'yes']) expect(coerceParamValue(spec, v, 'b', 'u')).toBe(true)
    for (const v of ['false', 'FALSE', '0', 'no']) expect(coerceParamValue(spec, v, 'b', 'u')).toBe(false)
  })

  it('rejects an unrecognized boolean spelling', () => {
    expect(() => coerceParamValue({ kind: 'boolean', label: 'b' }, 'maybe', 'b', 'u'))
      .toThrow(/must be true\/false/)
  })

  it('parses multiselect from a comma list or JSON', () => {
    const spec = { kind: 'multiselect' as const, label: 'm', options: ['a', 'b', 'c'] }
    expect(coerceParamValue(spec, 'a, b', 'm', 'u')).toEqual(['a', 'b'])
    expect(coerceParamValue(spec, '["a","c"]', 'm', 'u')).toEqual(['a', 'c'])
  })

  it('parses keyvalue from a comma list (colon- or equals-separated) or JSON', () => {
    const spec = { kind: 'keyvalue' as const, label: 'k', default: [] }
    expect(coerceParamValue(spec, 'find:replace,foo=bar', 'k', 'u')).toEqual([['find', 'replace'], ['foo', 'bar']])
    expect(coerceParamValue(spec, 'a\\,b:c', 'k', 'u')).toEqual([['a,b', 'c']])
    expect(coerceParamValue(spec, '[["a","b"]]', 'k', 'u')).toEqual([['a', 'b']])
    expect(coerceParamValue(spec, '{"a":"1","b":"2"}', 'k', 'u')).toEqual([['a', '1'], ['b', '2']])
  })

  it('rejects invalid JSON for multiselect/keyvalue', () => {
    expect(() => coerceParamValue({ kind: 'multiselect', label: 'm', options: [] }, '[', 'm', 'u')).toThrow(UsageError)
    expect(() => coerceParamValue({ kind: 'keyvalue', label: 'k', default: [] }, '{', 'k', 'u')).toThrow(UsageError)
  })

  it('passes strings and selects through, resolving \\, escapes', () => {
    expect(coerceParamValue({ kind: 'string', label: 's' }, 'hello', 's', 'u')).toBe('hello')
    expect(coerceParamValue({ kind: 'string', label: 's' }, 'a\\,b', 's', 'u')).toBe('a,b')
    expect(coerceParamValue({ kind: 'regex', label: 'r' }, '\\d+\\,\\s', 'r', 'u')).toBe('\\d+,\\s')
    expect(coerceParamValue({ kind: 'select', label: 's', options: ['a'] }, 'a', 's', 'u')).toBe('a')
  })
})

describe('parseStepSpec', () => {
  it('parses a bare utility id with no params', () => {
    const step = parseStepSpec('trim', 0, staticRegistry)
    expect(step).toEqual({ id: 'cli_0', utilityId: 'trim', params: {} })
  })

  it('parses typed params', () => {
    const step = parseStepSpec('uuid:version=v4,count=3,uppercase=true', 0, staticRegistry)
    expect(step.params).toEqual({ version: 'v4', count: 3, uppercase: true })
  })

  it('handles an escaped comma inside a value', () => {
    const step = parseStepSpec('split_join:joinWith=a\\,b', 0, staticRegistry)
    expect(step.params?.joinWith).toBe('a,b')
  })

  it('lets a multiselect / keyvalue value run on over plain commas', () => {
    expect(parseStepSpec('extract_preset:type=urls,emails,unique=true', 0, staticRegistry).params)
      .toEqual({ type: ['urls', 'emails'], unique: true })
    expect(parseStepSpec('multi_replace:rules=a:b,c=d,regex=true', 0, staticRegistry).params)
      .toEqual({ rules: [['a', 'b'], ['c', 'd']], regex: true })
  })

  it('throws for an unknown utility id', () => {
    expect(() => parseStepSpec('not_a_real_utility', 0, staticRegistry)).toThrow(/unknown utility/)
  })

  it('throws for an unknown param key, listing valid ones', () => {
    expect(() => parseStepSpec('uuid:bogus=1', 0, staticRegistry)).toThrow(/unknown param 'bogus'.*valid params: .*version/)
  })

  it('does not accept inherited Object.prototype names as params', () => {
    expect(() => parseStepSpec('trim:toString=1', 0, staticRegistry)).toThrow(/unknown param 'toString'/)
    expect(() => parseStepSpec('trim:__proto__={"x":1}', 0, staticRegistry)).toThrow(/unknown param '__proto__'/)
  })

  it('throws when a param is given twice', () => {
    expect(() => parseStepSpec('uuid:count=1,count=2', 0, staticRegistry)).toThrow(/given twice/)
  })

  it('throws for an invalid select option, listing the valid ones', () => {
    expect(() => parseStepSpec('get_bytes:mode=nope', 0, staticRegistry)).toThrow(/invalid value.*one of: /)
  })

  it('throws for an invalid multiselect option, listing the valid ones', () => {
    expect(() => parseStepSpec('extract_preset:type=urls,nope', 0, staticRegistry))
      .toThrow(/unknown option: nope.*options: urls, emails/)
  })

  it('throws for a malformed key=value token', () => {
    expect(() => parseStepSpec('uuid:version', 0, staticRegistry)).toThrow(/expected key=value/)
  })
})
