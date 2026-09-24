import { describe, it, expect } from 'vitest'
import util from './index'

const E = String.fromCharCode(27)
const BEL = String.fromCharCode(7)
const CSI8 = String.fromCharCode(0x9b)
const ST = `${E}\\`

describe('strip_ansi', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('strip_ansi')
    expect(util.name).toBe('strip ansi codes')
    expect(util.category).toBe('String Ops')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
  })

  it('removes SGR colour codes', async () => {
    expect(await util.apply(`${E}[31mred${E}[0m`, {})).toBe('red')
    expect(await util.apply(`${E}[1;38;5;208mbold orange${E}[0m done`, {})).toBe('bold orange done')
  })

  it('removes cursor movement and erase sequences', async () => {
    expect(await util.apply(`${E}[2J${E}[1;1Hhello`, {})).toBe('hello')
    expect(await util.apply(`${E}[?25lspinner${E}[?25h`, {})).toBe('spinner')
  })

  it('leaves plain text, whitespace and unicode untouched', async () => {
    expect(await util.apply('plain\ttext\nline2', {})).toBe('plain\ttext\nline2')
    expect(await util.apply(`${E}[32mcafé \u{1F600}\n${E}[0m`, {})).toBe('café \u{1F600}\n')
  })

  it('drops OSC payloads in strip mode', async () => {
    expect(await util.apply(`${E}]0;my title${BEL}hello`, {})).toBe('hello')
    expect(await util.apply(`${E}]8;;https://example.com${ST}link${E}]8;;${ST}`, { mode: 'strip' })).toBe('link')
  })

  it('keeps OSC text in keep-text mode', async () => {
    expect(await util.apply(`${E}]0;my title${BEL}hello`, { mode: 'keep-text' })).toBe('my titlehello')
    expect(await util.apply(`${E}]8;;https://example.com${ST}link${E}]8;;${ST}`, { mode: 'keep-text' }))
      .toBe('https://example.comlink')
    // CSI sequences are still removed in keep-text mode
    expect(await util.apply(`${E}[31mred${E}[0m`, { mode: 'keep-text' })).toBe('red')
  })

  it('never re-emits escape sequences smuggled inside an OSC payload', async () => {
    const out = await util.apply(`${E}]0;ti${E}[31mtle${BEL}z`, { mode: 'keep-text' })
    expect(out).toBe('titlez')
    expect(String(out)).not.toContain(E)
  })

  it('handles plain escapes, device control strings and 8-bit C1 forms', async () => {
    expect(await util.apply(`${E}(Bhello`, {})).toBe('hello')
    expect(await util.apply(`${E}=x${E}>y`, {})).toBe('xy')
    expect(await util.apply(`${E}P+q544e${ST}text`, {})).toBe('text')
    expect(await util.apply(`${CSI8}31mred`, {})).toBe('red')
  })

  it('returns empty string for empty input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('', { mode: 'keep-text' })).toBe('')
  })

  it('throws on truncated escape sequences', () => {
    expect(() => util.apply(`${E}[31`, {})).toThrow(/unterminated CSI/)
    expect(() => util.apply(`${E}]0;title`, {})).toThrow(/unterminated OSC/)
    expect(() => util.apply(`red${E}`, {})).toThrow(/unterminated ANSI/)
    expect(() => util.apply(`${E}\n`, {})).toThrow(/malformed ANSI/)
  })
})
