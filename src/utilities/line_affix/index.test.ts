import { describe, it, expect } from 'vitest'
import util from './index'

describe('line_affix', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('line_affix')
    expect(util.name).toBe('prefix / suffix lines')
    expect(util.category).toBe('Lines')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('adds a prefix, a suffix, or both', async () => {
    expect(await util.apply('a\nb', { prefix: '- ' })).toBe('- a\n- b')
    expect(await util.apply('a\nb', { suffix: ',' })).toBe('a,\nb,')
    expect(await util.apply('a\nb', { prefix: '<li>', suffix: '</li>' })).toBe(
      '<li>a</li>\n<li>b</li>'
    )
  })

  it('skips blank lines by default and affixes them when told not to', async () => {
    expect(await util.apply('a\n\nb', { prefix: '> ' })).toBe('> a\n\n> b')
    expect(await util.apply('a\n   \nb', { prefix: '> ', skipBlank: true })).toBe('> a\n   \n> b')
    expect(await util.apply('a\n\nb', { prefix: '> ', skipBlank: false })).toBe('> a\n> \n> b')
  })

  it('joins with a custom separator for one-line output', async () => {
    expect(await util.apply('a\nb\nc', { prefix: "'", suffix: "'", joinWith: ', ' })).toBe(
      "'a', 'b', 'c'"
    )
    // a skipped blank line is dropped rather than joined as an empty item
    expect(await util.apply('a\n\nb', { prefix: "'", suffix: "'", joinWith: ', ' })).toBe(
      "'a', 'b'"
    )
    expect(
      await util.apply('a\n\nb', { prefix: "'", suffix: "'", joinWith: ', ', skipBlank: false })
    ).toBe("'a', '', 'b'")
  })

  it('understands typed escapes in the affixes and the joiner', async () => {
    expect(await util.apply('a\nb', { prefix: '\\t' })).toBe('\ta\n\tb')
    expect(await util.apply('a\nb', { joinWith: '\\n\\n' })).toBe('a\n\nb')
    // an unknown escape is left verbatim, so LaTeX and regex snippets survive
    expect(await util.apply('x', { prefix: '\\item ' })).toBe('\\item x')
    expect(await util.apply('x', { suffix: '\\' })).toBe('x\\')
  })

  it('returns empty output for empty input, whatever the params', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { prefix: '- ' })).toBe('')
    expect(await util.apply('', { prefix: "'", suffix: "'", joinWith: ', ' })).toBe('')
    // an empty document is not "one blank line": skipBlank must not turn nothing
    // into a bare affix pair
    expect(await util.apply('', { prefix: '- ', skipBlank: false })).toBe('')
    expect(
      await util.apply('', { prefix: "'", suffix: "'", joinWith: ', ', skipBlank: false })
    ).toBe('')
  })

  it('leaves astral characters and non-latin text intact', async () => {
    expect(await util.apply('日本語\n🍎', { prefix: '🍎 ' })).toBe('🍎 日本語\n🍎 🍎')
    expect(await util.apply('🍎\n🍎', { suffix: '✓', joinWith: ' | ' })).toBe('🍎✓ | 🍎✓')
  })

  it('preserves the document line endings', async () => {
    expect(await util.apply('a\nb\n', { prefix: '# ' })).toBe('# a\n# b\n')
    expect(await util.apply('a\r\nb\r\n', { prefix: '# ' })).toBe('# a\r\n# b\r\n')
  })

  it('never throws — every combination of params is valid', async () => {
    // there is no malformed input for this utility, so the contract is that every
    // param combination produces text rather than an error
    expect(() => util.apply('', {})).not.toThrow()
    expect(() => util.apply('a', { prefix: '\\', suffix: '\\', joinWith: '\\' })).not.toThrow()
    // empty affixes are a deliberate no-op that leaves the document byte-identical
    expect(await util.apply('a\n\n\nb', { prefix: '', suffix: '', joinWith: '' })).toBe('a\n\n\nb')
    // a lone backslash in every slot is kept verbatim and used as the joiner
    expect(await util.apply('a\nb', { prefix: '\\', suffix: '\\', joinWith: '\\' })).toBe(
      '\\a\\\\\\b\\'
    )
  })
})
