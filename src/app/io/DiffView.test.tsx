import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import DiffView, { MAX_DIFF_CHARS } from './DiffView'

/** Stands in for diff's async (callback) mode: the result arrives on a later macrotask. */
const diffLines = vi.hoisted(() => vi.fn((a: string, b: string, opts: { callback: (r: unknown) => void }) => {
  const result = b === 'SLOW'
    ? undefined // what diff reports when its `timeout` option expires
    : a === b
      ? [{ value: a, added: false, removed: false, count: 1 }]
      : [
          { value: `${a}\n`, added: false, removed: true, count: 1 },
          { value: `${b}\n`, added: true, removed: false, count: 1 },
        ]
  setTimeout(() => opts.callback(result), 0)
  return undefined
}))
vi.mock('diff', () => ({ diffLines }))

/** Each line is a row of [sign, text]. */
const rows = (region: HTMLElement) => Array.from(region.children).map(r => Array.from(r.children).map(c => c.textContent))

describe('DiffView', () => {
  it('lazily loads the diff package and renders added/removed lines', async () => {
    render(<DiffView before="hello" after="world" />)
    expect(screen.getByText(/computing diff/i)).toBeTruthy()
    const region = await screen.findByRole('region', { name: 'input to output diff' })
    expect(rows(region)).toEqual([['-', 'hello'], ['+', 'world']])
  })

  it('shows unchanged content with a neutral prefix', async () => {
    render(<DiffView before="same" after="same" />)
    const region = await screen.findByRole('region', { name: 'input to output diff' })
    expect(rows(region)).toEqual([['', 'same']])
  })

  it('passes a timeout so a pathological diff cannot hang the page, and says so when it expires', async () => {
    render(<DiffView before="a" after="SLOW" />)
    expect(await screen.findByText(/too long to diff/i)).toBeTruthy()
    expect(diffLines).toHaveBeenLastCalledWith('a', 'SLOW', expect.objectContaining({ timeout: expect.any(Number), callback: expect.any(Function) }))
  })

  it('does not diff inputs beyond the size cap', async () => {
    diffLines.mockClear()
    const big = 'x'.repeat(MAX_DIFF_CHARS)
    render(<DiffView before={big} after="y" />)
    expect(screen.getByText(/too large to diff/i)).toBeTruthy()
    await new Promise(r => setTimeout(r, 300))
    expect(diffLines).not.toHaveBeenCalled()
  })

  it('keeps showing the previous diff (not a loading flash) while an edit is re-diffed', async () => {
    const { rerender } = render(<DiffView before="one" after="two" />)
    await screen.findByRole('region', { name: 'input to output diff' })
    rerender(<DiffView before="one" after="three" />)
    expect(screen.queryByText(/computing diff/i)).toBeNull()
    expect(rows(screen.getByRole('region', { name: 'input to output diff' }))).toContainEqual(['+', 'two'])
    await waitFor(() => expect(rows(screen.getByRole('region', { name: 'input to output diff' }))).toContainEqual(['+', 'three']))
  })
})
