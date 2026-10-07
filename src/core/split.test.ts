import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { itemNoun, itemText, splitItems } from './split'
import type { SplitSpec, Value } from '../types/utility'

const LINES: SplitSpec = { mode: 'lines' }
const identity = (input: Value, spec: SplitSpec) => {
  const s = splitItems(input, spec)
  return s.join(s.items)
}

describe('splitItems: lines', () => {
  it('splits on \\n and rejoins', () => {
    const s = splitItems('a\nb\nc', LINES)
    expect(s.items).toEqual(['a', 'b', 'c'])
    expect(s.join(['A', 'B', 'C'])).toBe('A\nB\nC')
  })

  it('treats a final newline as the end of the last line, not an empty extra item', () => {
    const s = splitItems('a\nb\n', LINES)
    expect(s.items).toEqual(['a', 'b'])
    expect(s.join(['A', 'B'])).toBe('A\nB\n')
  })

  it('keeps empty lines in the middle as items', () => {
    expect(splitItems('a\n\nb', LINES).items).toEqual(['a', '', 'b'])
    expect(splitItems('\n', LINES).items).toEqual([''])
  })

  it('has no items for empty input', () => {
    const s = splitItems('', LINES)
    expect(s.items).toEqual([])
    expect(s.join([])).toBe('')
  })

  it('sets CRLF line endings aside and restores them per line', () => {
    const s = splitItems('a\r\nb\nc\r\n', LINES)
    expect(s.items).toEqual(['a', 'b', 'c'])
    expect(s.join(['1', '2', '3'])).toBe('1\r\n2\n3\r\n')
  })

  it('treats a lone \\r at the very end as a line ending too', () => {
    const s = splitItems('a\r', LINES)
    expect(s.items).toEqual(['a'])
    expect(s.join(['A'])).toBe('A\r')
  })

  it('names items by 1-based line number', () => {
    expect(splitItems('a\nb', LINES).label(1)).toBe('line 2')
  })

  it('reads bytes as UTF-8 and JSON as compact text', () => {
    expect(splitItems(new TextEncoder().encode('é\nü'), LINES).items).toEqual(['é', 'ü'])
    expect(splitItems({ a: [1, 2] } as Value, LINES).items).toEqual(['{"a":[1,2]}'])
  })

  it('writes JSON results as one compact line and bytes as text', () => {
    const s = splitItems('a\nb', LINES)
    expect(s.join([{ x: 1 } as Value, new TextEncoder().encode('ü')])).toBe('{"x":1}\nü')
  })

  it('keeps unicode (astral characters, combining marks) intact', () => {
    const text = '🎉 party\né\n日本語'
    expect(identity(text, LINES)).toBe(text)
  })
})

describe('splitItems: delimiter', () => {
  const COMMA: SplitSpec = { mode: 'delimiter', separator: ', ' }

  it('splits on a literal separator and rejoins with it', () => {
    const s = splitItems('a, b, c', COMMA)
    expect(s.items).toEqual(['a', 'b', 'c'])
    expect(s.join(['1', '2', '3'])).toBe('1, 2, 3')
    expect(s.label(2)).toBe('item 3')
  })

  it('does not treat the separator as a regular expression', () => {
    expect(splitItems('a.b|c', { mode: 'delimiter', separator: '.' }).items).toEqual(['a', 'b|c'])
  })

  it('keeps empty pieces, including a trailing one', () => {
    expect(splitItems('a,,b,', { mode: 'delimiter', separator: ',' }).items).toEqual(['a', '', 'b', ''])
  })

  it('has no items for empty input and refuses an empty separator', () => {
    expect(splitItems('', COMMA).items).toEqual([])
    expect(() => splitItems('abc', { mode: 'delimiter', separator: '' })).toThrow(/separator is empty/)
  })
})

describe('splitItems: json-array', () => {
  const ARRAY: SplitSpec = { mode: 'json-array' }

  it('hands strings over as text, objects as JSON and primitives as JSON text', () => {
    const s = splitItems('["a", 1, true, null, {"k": 2}, [3]]', ARRAY)
    expect(s.items).toEqual(['a', '1', 'true', 'null', { k: 2 }, [3]])
  })

  it('gives every element back unchanged through an identity pipeline', () => {
    const input = [' a ', 1.5, -2, false, null, { k: [1, { x: 'y' }] }, [], '']
    expect(identity(input as Value, ARRAY)).toEqual(input)
  })

  it('keeps a primitive a primitive when its result still parses as one, else makes it text', () => {
    const s = splitItems('[1, 2, true, "5"]', ARRAY)
    expect(s.join(['42', '2023-11-14T22:13:20Z', 'TRUE', '6'])).toEqual([42, '2023-11-14T22:13:20Z', 'TRUE', '6'])
  })

  it('names items by JSON index', () => {
    expect(splitItems('[1,2]', ARRAY).label(1)).toBe('[1]')
  })

  it('refuses input that is not a JSON array, readably', () => {
    expect(() => splitItems('{"a":1}', ARRAY)).toThrow('expected a JSON array, got an object')
    expect(() => splitItems('5', ARRAY)).toThrow('expected a JSON array, got a number')
    expect(() => splitItems('nope', ARRAY)).toThrow(/^the input is not valid JSON/)
  })
})

describe('splitItems: json-values', () => {
  const VALUES: SplitSpec = { mode: 'json-values' }

  it('runs on each top-level value and keeps keys and their order', () => {
    const s = splitItems('{"b": "x", "a": "y", "n": 3}', VALUES)
    expect(s.items).toEqual(['x', 'y', '3'])
    const out = s.join(['X', 'Y', '4']) as Record<string, unknown>
    expect(out).toEqual({ b: 'X', a: 'Y', n: 4 })
    expect(Object.keys(out)).toEqual(['b', 'a', 'n'])
  })

  it('does not recurse into nested objects', () => {
    expect(splitItems('{"a": {"b": "c"}}', VALUES).items).toEqual([{ b: 'c' }])
  })

  it('keeps a "__proto__" key as an own key, not a prototype', () => {
    const s = splitItems('{"__proto__": "x", "ok": "y"}', VALUES)
    const out = s.join(['X', 'Y']) as Record<string, unknown>
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype)
    expect(Object.prototype.hasOwnProperty.call(out, '__proto__')).toBe(true)
    expect(JSON.stringify(out)).toBe('{"__proto__":"X","ok":"Y"}')
  })

  it('names items by their quoted key, shortened when long', () => {
    const s = splitItems({ apiKey: 'v', ['k'.repeat(50)]: 'w' } as Value, VALUES)
    expect(s.label(0)).toBe('"apiKey"')
    expect(s.label(1)).toBe(`"${'k'.repeat(40)}…"`)
  })

  it('refuses arrays and non-objects', () => {
    expect(() => splitItems('[1]', VALUES)).toThrow('expected a JSON object, got an array')
    expect(() => splitItems('null', VALUES)).toThrow('expected a JSON object, got null')
  })
})

describe('itemText / itemNoun', () => {
  it('renders results as text', () => {
    expect(itemText('x')).toBe('x')
    expect(itemText(null as unknown as Value)).toBe('')
    expect(itemText([1, 'a'] as Value)).toBe('[1,"a"]')
  })

  it('names items per mode', () => {
    expect(itemNoun('lines', 1)).toBe('line')
    expect(itemNoun('json-values', 3)).toBe('values')
  })
})

describe('properties', () => {
  // every string, including lone surrogates and every mix of \r and \n
  const text = fc.oneof(
    fc.string({ unit: 'binary', maxLength: 200 }),
    fc.array(fc.constantFrom('a', '\n', '\r', '\r\n', '', ' ', 'é', '\uD83C'), { maxLength: 40 }).map(a => a.join('')),
  )

  it('lines: an identity pipeline gives every string back unchanged', () => {
    fc.assert(fc.property(text, s => identity(s, LINES) === s), { numRuns: 500 })
  })

  it('delimiter: an identity pipeline gives every string back unchanged', () => {
    const sep = fc.string({ minLength: 1, maxLength: 3 })
    fc.assert(fc.property(text, sep, (s, separator) => identity(s, { mode: 'delimiter', separator }) === s), { numRuns: 500 })
  })

  it('json-array: an identity pipeline gives every array back unchanged', () => {
    fc.assert(fc.property(fc.array(fc.jsonValue()), arr => {
      // JSON has no -0: compare as the JSON text the value would be stored as
      const input = JSON.parse(JSON.stringify(arr))
      return JSON.stringify(identity(input, { mode: 'json-array' })) === JSON.stringify(input)
    }), { numRuns: 300 })
  })

  it('lines: the line count is the number of newlines, plus one unless the text ends with one', () => {
    fc.assert(fc.property(text, s => {
      const n = splitItems(s, LINES).items.length
      const newlines = s.split('\n').length - 1
      return n === (s === '' ? 0 : newlines + (s.endsWith('\n') ? 0 : 1))
    }), { numRuns: 300 })
  })
})
