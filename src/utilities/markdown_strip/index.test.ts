import { describe, it, expect } from 'vitest'
import util from './index'

const DOC = [
  '# Title',
  '',
  'Some **bold** and *italic* and `code` text.',
  '',
  '- item one',
  '- item two',
  '',
  '[link](https://example.com) and ![img](pic.png)',
  '',
  '> quoted line',
  '',
  '---',
  '',
  '```js',
  'const x = 1',
  '```'
].join('\n')

describe('markdown_strip', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('markdown_strip')
    expect(util.name).toBe('strip markdown')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['keepCodeBlocks', 'keepLinkUrls'])
  })

  it('strips a realistic document with defaults', async () => {
    expect(await util.apply(DOC, {})).toBe(
      [
        'Title',
        '',
        'Some bold and italic and code text.',
        '',
        'item one',
        'item two',
        '',
        'link and img',
        '',
        'quoted line',
        '',
        'const x = 1'
      ].join('\n')
    )
  })

  it('returns empty output for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n\n  ', {})).toBe('')
  })

  it('honours keepLinkUrls', async () => {
    const line = '[link](https://example.com) and ![img](pic.png)'
    expect(await util.apply(line, { keepLinkUrls: false })).toBe('link and img')
    expect(await util.apply(line, { keepLinkUrls: true })).toBe(
      'link (https://example.com) and img (pic.png)'
    )
  })

  it('honours keepCodeBlocks', async () => {
    expect(await util.apply(DOC, { keepCodeBlocks: true })).toContain('const x = 1')
    const dropped = (await util.apply(DOC, { keepCodeBlocks: false })) as string
    expect(dropped).not.toContain('const x = 1')
    expect(dropped.endsWith('quoted line')).toBe(true)
  })

  it('preserves unicode, including astral characters', async () => {
    expect(await util.apply('**Café 😀** and _naïve_ and ~~struck~~', {})).toBe(
      'Café 😀 and naïve and struck'
    )
  })

  it('leaves snake_case identifiers and escaped markers alone', async () => {
    expect(await util.apply('keep snake_case_names and file_name.txt', {})).toBe(
      'keep snake_case_names and file_name.txt'
    )
    expect(await util.apply('\\*not emphasis\\*', {})).toBe('*not emphasis*')
  })

  it('does not strip markdown syntax that lives inside a code span', async () => {
    expect(await util.apply('use `a *b* c` here', {})).toBe('use a *b* c here')
  })

  it('handles headings, quotes, lists, autolinks and raw html', async () => {
    expect(await util.apply('## Title ##', {})).toBe('Title')
    expect(await util.apply('Title\n=====\n\nbody text', {})).toBe('Title\n\nbody text')
    expect(await util.apply('> > deep quote', {})).toBe('deep quote')
    expect(await util.apply('1. first\n2. second', {})).toBe('first\nsecond')
    expect(await util.apply('- [x] done\n- [ ] todo', {})).toBe('done\ntodo')
    expect(await util.apply('see <https://example.com> now', {})).toBe('see https://example.com now')
    expect(await util.apply('<b>bold</b> text', {})).toBe('bold text')
    expect(await util.apply('kept<!-- hidden -->text', {})).toBe('kepttext')
  })

  it('strips inline markup that spans a soft line break inside a paragraph', async () => {
    // Wrapped prose is the normal case: emphasis and links routinely straddle
    // a newline, and CommonMark treats them as a single span.
    expect(await util.apply('a *soft\nwrapped* b', {})).toBe('a soft\nwrapped b')
    expect(await util.apply('see [the\ndocs](https://e.com) now', {})).toBe('see the\ndocs now')
    // A blank line ends the span, so unpaired markers in separate paragraphs stay.
    expect(await util.apply('*not\n\nemphasis*', {})).toBe('*not\n\nemphasis*')
  })

  it('drops link reference definitions but keeps the reference text', async () => {
    expect(await util.apply('a [thing][ref] b\n\n[ref]: https://example.com "T"', {})).toBe(
      'a thing b'
    )
  })

  it('rejects structured input instead of stringifying it', async () => {
    expect(() => util.apply({ a: 1 } as any, {})).toThrow(/structured data/)
  })
})

describe('markdown_strip — attacker-sized input', () => {
  // the per-line /[ \t]+$/ trim was quadratic on a long space run that does not end the line
  it('strips a line holding a huge inner run of spaces in linear time', () => {
    const t0 = performance.now()
    const out = util.apply(' '.repeat(200_000) + 'x  ', {}) as string
    expect(performance.now() - t0).toBeLessThan(1500)
    expect(out).toBe('x')
  })

  it('strips a heading holding a huge inner run of spaces in linear time', () => {
    const t0 = performance.now()
    const out = util.apply('# a' + ' '.repeat(200_000) + 'b ##', {}) as string
    expect(performance.now() - t0).toBeLessThan(1500)
    expect(out).toBe('a' + ' '.repeat(200_000) + 'b')
  })

  it('still drops a closing ATX sequence and trailing blanks', () => {
    expect(util.apply('# Title  ##  \n\ntext \t', {})).toBe('Title\n\ntext')
  })
})
