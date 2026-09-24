import { describe, it, expect } from 'vitest'
import util from './index'

const STORE = JSON.stringify({
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      {
        category: 'fiction',
        author: 'Herman Melville',
        title: 'Moby Dick',
        isbn: '0-553-21311-3',
        price: 8.99
      },
      {
        category: 'fiction',
        author: 'J. R. R. Tolkien',
        title: 'The Lord of the Rings',
        isbn: '0-395-19395-8',
        price: 22.99
      }
    ],
    bicycle: { color: 'red', price: 19.95 }
  },
  expensive: 10
})

const UNICODE = JSON.stringify({ café: { emoji: '👩‍🚀', words: ['naïve', '日本語'] } })

const run = async (input: string, params: Record<string, unknown>) =>
  String(await util.apply(input, params))

describe('jsonpath', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('jsonpath')
    expect(util.name).toBe('jsonpath query')
    expect(util.category).toBe('Data Formats')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['indent', 'mode', 'path'])
  })

  it('walks child keys and wildcards', async () => {
    expect(await run(STORE, { path: '$.store.book[*].author', indent: 0 })).toBe(
      '["Nigel Rees","Evelyn Waugh","Herman Melville","J. R. R. Tolkien"]'
    )
    expect(await run(STORE, { path: "$['store']['bicycle']['color']", indent: 0 })).toBe('["red"]')
    expect(await run(STORE, { path: '$.store.*', mode: 'count' })).toBe('2')
    expect(await run(STORE, { path: '$.store.bicycle.*', indent: 0 })).toBe('["red",19.95]')
  })

  it('supports recursive descent', async () => {
    expect(await run(STORE, { path: '$..price', indent: 0 })).toBe('[8.95,12.99,8.99,22.99,19.95]')
    expect(await run(STORE, { path: '$..book[0].title', indent: 0 })).toBe(
      '["Sayings of the Century"]'
    )
    expect(await run(STORE, { path: '$..isbn', mode: 'count' })).toBe('2')
  })

  it('supports indices, negative indices, slices and unions', async () => {
    expect(await run(STORE, { path: '$.store.book[-1].author', indent: 0 })).toBe(
      '["J. R. R. Tolkien"]'
    )
    expect(await run(STORE, { path: '$.store.book[0:2].title', indent: 0 })).toBe(
      '["Sayings of the Century","Sword of Honour"]'
    )
    expect(await run(STORE, { path: '$.store.book[::2].price', indent: 0 })).toBe('[8.95,8.99]')
    expect(await run(STORE, { path: '$.store.book[::-1].price', indent: 0 })).toBe(
      '[22.99,8.99,12.99,8.95]'
    )
    expect(await run(STORE, { path: '$.store.book[0,2].price', indent: 0 })).toBe('[8.95,8.99]')
    expect(await run('{"a":1,"b":2,"c":3}', { path: "$['a','c']", indent: 0 })).toBe('[1,3]')
  })

  it('evaluates filter expressions', async () => {
    expect(await run(STORE, { path: '$..book[?(@.price < 10)].title', indent: 0 })).toBe(
      '["Sayings of the Century","Moby Dick"]'
    )
    // $ inside a filter refers back to the root document
    expect(await run(STORE, { path: '$..book[?(@.price > $.expensive)].title', indent: 0 })).toBe(
      '["Sword of Honour","The Lord of the Rings"]'
    )
    expect(await run(STORE, { path: '$..book[?(@.isbn)].author', indent: 0 })).toBe(
      '["Herman Melville","J. R. R. Tolkien"]'
    )
    expect(
      await run(STORE, { path: '$..book[?(@.category=="fiction" && @.price>20)].author', indent: 0 })
    ).toBe('["J. R. R. Tolkien"]')
    expect(
      await run(STORE, { path: "$..book[?(@.category=='reference' || @.price>20)].title", indent: 0 })
    ).toBe('["Sayings of the Century","The Lord of the Rings"]')
    expect(await run(STORE, { path: '$..book[?(!(@.isbn))].author', indent: 0 })).toBe(
      '["Nigel Rees","Evelyn Waugh"]'
    )
    expect(await run(STORE, { path: '$..book[?(@.author =~ /^Nigel/)].price', indent: 0 })).toBe(
      '[8.95]'
    )
    expect(await run(STORE, { path: '$..book[?(@.category != "fiction")].price', indent: 0 })).toBe(
      '[8.95]'
    )
    expect(await run(STORE, { path: '$..book[?(@.price >= 12.99)]', mode: 'count' })).toBe('2')
    expect(await run(STORE, { path: '$..book[?(@.price <= 8.99)]', mode: 'count' })).toBe('2')
  })

  it('treats a bare filter path as an existence test (present and not null)', async () => {
    const doc = '[{"n":0},{"n":null},{"x":1},{"n":false}]'
    expect(await run(doc, { path: '$[?(@.n)]', mode: 'count' })).toBe('2')
    expect(await run(doc, { path: '$[?(@.n == null)]', mode: 'count' })).toBe('1')
  })

  it('exposes every result mode', async () => {
    expect(await run(STORE, { path: '$.store.book[0].title', mode: 'values', indent: 0 })).toBe(
      '["Sayings of the Century"]'
    )
    expect(await run(STORE, { path: '$.store.book[0].title', mode: 'paths', indent: 0 })).toBe(
      '["$[\'store\'][\'book\'][0][\'title\']"]'
    )
    // `first` unwraps a lone string so it can feed straight into string utilities
    expect(await run(STORE, { path: '$.store.book[0].title', mode: 'first' })).toBe(
      'Sayings of the Century'
    )
    expect(await run(STORE, { path: '$.store.bicycle', mode: 'first', indent: 0 })).toBe(
      '{"color":"red","price":19.95}'
    )
    expect(await run(STORE, { path: '$.nope', mode: 'first' })).toBe('')
    expect(await run(STORE, { path: '$..author', mode: 'count' })).toBe('4')
  })

  it('honours the indent param and defaults the path to $', async () => {
    expect(await run(STORE, { path: '$.expensive', indent: 0 })).toBe('[10]')
    expect(await run(STORE, { path: '$.expensive', indent: 2 })).toBe('[\n  10\n]')
    expect(await run(STORE, { path: '$.expensive' })).toBe('[\n  10\n]')
    expect(await run('{"a":1}', { path: '', indent: 0 })).toBe('[{"a":1}]')
    expect(await run('{"a":1}', { indent: 0 })).toBe('[{"a":1}]')
  })

  it('handles unicode keys, values and code-point lengths', async () => {
    expect(await run(UNICODE, { path: '$.café.emoji', mode: 'first' })).toBe('👩‍🚀')
    expect(await run(UNICODE, { path: "$['café'].words[*]", indent: 0 })).toBe('["naïve","日本語"]')
    expect(await run(UNICODE, { path: '$.café.words[?(@ =~ /語/)]', indent: 0 })).toBe('["日本語"]')
    // length counts code points, so the astral characters are not split
    expect(await run(UNICODE, { path: '$.café.emoji.length', mode: 'first' })).toBe('3')
    expect(await run(UNICODE, { path: '$.café.words.length', mode: 'first' })).toBe('2')
  })

  it('returns an empty result for empty input instead of throwing', async () => {
    expect(await run('', { path: '$.a' })).toBe('[]')
    expect(await run('   ', { path: '$.a', mode: 'paths' })).toBe('[]')
    expect(await run('', { path: '$.a', mode: 'count' })).toBe('0')
    expect(await run('', { path: '$.a', mode: 'first' })).toBe('')
  })

  it('returns no matches (rather than throwing) for paths that do not exist', async () => {
    expect(await run('{"a":1}', { path: '$.b.c.d', indent: 0 })).toBe('[]')
    expect(await run('{"a":1}', { path: '$.a[5]', indent: 0 })).toBe('[]')
  })

  it('tolerates a leading byte order mark on the document', async () => {
    expect(await run('\uFEFF' + STORE, { path: '$.expensive', indent: 0 })).toBe('[10]')
    expect(await run('\uFEFF{"a":1}', { path: '$.a', mode: 'first' })).toBe('1')
  })

  it('rejects a filter test that is a bare value instead of a path', async () => {
    // the common typo `[?(price)]` must not silently match every node
    expect(() => util.apply(STORE, { path: '$..book[?(price)]' })).toThrow(
      /"price" is not a filter test/
    )
    expect(() => util.apply(STORE, { path: '$..book[?("fiction")]' })).toThrow(/not a bare value/)
    expect(() => util.apply(STORE, { path: '$..book[?(/x/)]' })).toThrow(/"=~"/)
    // a bare word is still valid on the right-hand side of a comparison
    expect(await run(STORE, { path: '$..book[?(@.category==fiction)]', mode: 'count' })).toBe('3')
    // and an explicit boolean test still selects every child
    expect(await run('[1,2]', { path: '$[?(true)]', indent: 0 })).toBe('[1,2]')
    expect(await run('[1,2]', { path: '$[?(false)]', indent: 0 })).toBe('[]')
  })

  it('throws on invalid JSON and invalid paths', () => {
    expect(() => util.apply('{oops}', { path: '$' })).toThrow(/not valid JSON/)
    expect(() => util.apply('{"a":1}', { path: '$[' })).toThrow(/unterminated/)
    expect(() => util.apply('{"a":1}', { path: '$..' })).toThrow(/property name/)
    expect(() => util.apply('{"a":1}', { path: '$[?()]' })).toThrow(/filter expression/)
    expect(() => util.apply('{"a":1}', { path: '$[1:2:0]' })).toThrow(/step cannot be 0/)
    expect(() => util.apply('{"a":1}', { path: '$.a' })).not.toThrow()
  })
})
