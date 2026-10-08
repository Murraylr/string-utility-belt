import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import StepDiff from './StepDiff'
import { buildDiffRows, toLineOps } from './diffRows'

vi.setConfig({ testTimeout: 20000 })

describe('buildDiffRows', () => {
  const ctx = (n, type = 'ctx') => Array.from({ length: n }, (_, i) => ({ type, text: `l${i}` }))

  it('keeps a short run of unchanged lines uncollapsed', () => {
    const ops = [{ type: 'add', text: 'x' }, ...ctx(2), { type: 'remove', text: 'y' }]
    const rows = buildDiffRows(ops)
    expect(rows.filter(r => r.type === 'collapse')).toHaveLength(0)
    expect(rows).toHaveLength(4)
  })

  it('collapses a long middle run to context lines on each side', () => {
    const ops = [{ type: 'add', text: 'x' }, ...ctx(10), { type: 'remove', text: 'y' }]
    const rows = buildDiffRows(ops, 3)
    const collapse = rows.find(r => r.type === 'collapse')
    expect(collapse.count).toBe(4) // 10 - 3 - 3
    expect(rows.filter(r => r.type === 'ctx')).toHaveLength(6)
  })

  it('only trims the trailing edge of a leading unchanged run', () => {
    const ops = [...ctx(10), { type: 'add', text: 'x' }]
    const rows = buildDiffRows(ops, 3)
    expect(rows[0]).toEqual({ type: 'collapse', count: 7 })
    expect(rows.slice(1, 4).map(r => r.text)).toEqual(['l7', 'l8', 'l9'])
  })

  it('only trims the leading edge of a trailing unchanged run', () => {
    const ops = [{ type: 'remove', text: 'x' }, ...ctx(10)]
    const rows = buildDiffRows(ops, 3)
    expect(rows.slice(1, 4).map(r => r.text)).toEqual(['l0', 'l1', 'l2'])
    expect(rows[4]).toEqual({ type: 'collapse', count: 7 })
  })
})

describe('toLineOps', () => {
  it('drops the trailing empty line a trailing newline leaves behind', () => {
    expect(toLineOps([{ value: 'a\nb\n' }])).toEqual([{ type: 'ctx', text: 'a' }, { type: 'ctx', text: 'b' }])
  })
})

describe('<StepDiff />', () => {
  it('shows added and removed lines with unchanged context collapsed', async () => {
    const before = Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n') + '\nremoved-line'
    const after = Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n') + '\nadded-line'
    render(<StepDiff before={before} after={after} />)
    const group = await screen.findByRole('group', { name: 'step diff' })
    expect(group.textContent).toContain('removed-line')
    expect(group.textContent).toContain('added-line')
    expect(group.textContent).toMatch(/unchanged lines/)
  })

  it('says "line" for a single collapsed unchanged line', async () => {
    // 4 leading unchanged lines: 3 kept as context, 1 collapsed
    render(<StepDiff before={'a\nb\nc\nd\nold'} after={'a\nb\nc\nd\nnew'} />)
    const group = await screen.findByRole('group', { name: 'step diff' })
    expect(group.textContent).toContain('… 1 unchanged line')
    expect(group.textContent).not.toContain('1 unchanged lines')
  })

  it('reports no textual change for equal text', async () => {
    render(<StepDiff before="same" after="same" />)
    expect(await screen.findByText('no textual change')).toBeTruthy()
  })

  it('reports a type mismatch instead of diffing across types', async () => {
    render(<StepDiff before="text" after={{ a: 1 }} />)
    expect(await screen.findByText('different value types')).toBeTruthy()
  })

  it('refuses to diff inputs over the 200KB cap', async () => {
    const big = 'x'.repeat(210 * 1024)
    render(<StepDiff before={big} after="small" />)
    expect(await screen.findByText('too large to diff')).toBeTruthy()
  })

  it('measures the cap in UTF-8 bytes, not UTF-16 code units', async () => {
    // 70K three-byte characters: 70K code units but 210KB of UTF-8
    const big = '€'.repeat(70 * 1024)
    render(<StepDiff before={big} after="small" />)
    expect(await screen.findByText('too large to diff')).toBeTruthy()
  })

  it('marks every added line with + and every removed line with -, colour-coded', async () => {
    render(<StepDiff before={'keep\nold'} after={'keep\nnew'} />)
    const group = await screen.findByRole('group', { name: 'step diff' })
    const rows = [...group.children].map(el => ({ text: el.textContent, cls: el.className }))
    expect(rows.find(r => r.text.includes('old'))).toMatchObject({ text: '- old' })
    expect(rows.find(r => r.text.includes('old')).cls).toMatch(/text-del-ink/)
    expect(rows.find(r => r.text.includes('new'))).toMatchObject({ text: '+ new' })
    expect(rows.find(r => r.text.includes('new')).cls).toMatch(/text-add-ink/)
    expect(rows.find(r => r.text.includes('keep')).cls).not.toMatch(/text-(add|del)-ink/)
  })

  it('diffs binary (non-UTF-8) bytes as hex instead of calling them unchanged', async () => {
    // both decode to U+FFFD as text, so a text-only diff would report "no textual change"
    render(<StepDiff before={new Uint8Array([0xff, 0x00])} after={new Uint8Array([0xfe, 0x00])} />)
    const group = await screen.findByRole('group', { name: 'step diff' })
    expect(group.textContent).toContain('ff 00')
    expect(group.textContent).toContain('fe 00')
  })

  it('reports identical bytes as unchanged', async () => {
    render(<StepDiff before={new Uint8Array([0xff, 1])} after={new Uint8Array([0xff, 1])} />)
    expect(await screen.findByText('no textual change')).toBeTruthy()
  })

  it('diffs UTF-8 bytes as text', async () => {
    const enc = new TextEncoder()
    render(<StepDiff before={enc.encode('héllo\nsame')} after={enc.encode('hello\nsame')} />)
    const group = await screen.findByRole('group', { name: 'step diff' })
    expect(group.textContent).toContain('- héllo')
    expect(group.textContent).toContain('+ hello')
  })

  it('diffs JSON values as pretty-printed text', async () => {
    render(<StepDiff before={{ a: 1, b: 2 }} after={{ a: 1, b: 3 }} />)
    const group = await screen.findByRole('group', { name: 'step diff' })
    expect(group.textContent).toContain('-   "b": 2')
    expect(group.textContent).toContain('+   "b": 3')
  })

  it('gives up quickly on a pathological diff instead of freezing the page', async () => {
    // every line differs: Myers is O(N·D) here and would block the main thread for many seconds
    const n = 5000
    const before = Array.from({ length: n }, (_, i) => `a${i}`).join('\n')
    const after = Array.from({ length: n }, (_, i) => `b${i}`).join('\n')
    const t0 = Date.now()
    render(<StepDiff before={before} after={after} />)
    expect(await screen.findByText(/too many changes to diff/, {}, { timeout: 15000 })).toBeTruthy()
    expect(Date.now() - t0).toBeLessThan(15000)
  })
})
