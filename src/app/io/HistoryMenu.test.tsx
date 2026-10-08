import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import HistoryMenu from './HistoryMenu'
import * as history from './history'

describe('HistoryMenu', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('opens to show recent entries and restores one on click', async () => {
    vi.spyOn(history, 'listHistory').mockResolvedValue([
      { id: '1', text: 'second input', savedAt: 2 },
      { id: '2', text: 'first input', savedAt: 1 },
    ])
    const user = userEvent.setup()
    const onRestore = vi.fn()
    render(<HistoryMenu onRestore={onRestore} />)

    await user.click(screen.getByRole('button', { name: /history/i }))
    const item = await screen.findByRole('button', { name: /restore: second input/i })
    await user.click(item)
    expect(onRestore).toHaveBeenCalledWith('second input')
  })

  it('shows an empty state with no history', async () => {
    vi.spyOn(history, 'listHistory').mockResolvedValue([])
    const user = userEvent.setup()
    render(<HistoryMenu onRestore={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /history/i }))
    expect(await screen.findByText(/no history yet/i)).toBeTruthy()
  })

  it('deletes a single entry', async () => {
    vi.spyOn(history, 'listHistory').mockResolvedValue([{ id: '1', text: 'to delete', savedAt: 1 }])
    const deleteSpy = vi.spyOn(history, 'deleteHistoryEntry').mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<HistoryMenu onRestore={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /history/i }))
    await user.click(await screen.findByRole('button', { name: /delete: to delete/i }))
    expect(deleteSpy).toHaveBeenCalledWith('1')
  })

  it('clears all entries', async () => {
    vi.spyOn(history, 'listHistory').mockResolvedValue([{ id: '1', text: 'a', savedAt: 1 }])
    const clearSpy = vi.spyOn(history, 'clearHistory').mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<HistoryMenu onRestore={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /history/i }))
    await user.click(await screen.findByRole('button', { name: /clear all/i }))
    expect(clearSpy).toHaveBeenCalled()
  })

  it('closes on Escape', async () => {
    vi.spyOn(history, 'listHistory').mockResolvedValue([])
    const user = userEvent.setup()
    render(<HistoryMenu onRestore={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /history/i }))
    await screen.findByText(/no history yet/i)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText(/no history yet/i)).toBeNull())
  })

  it('is a disclosure (aria-expanded + aria-controls), not a fake menu, and Escape returns focus to it', async () => {
    vi.spyOn(history, 'listHistory').mockResolvedValue([{ id: '1', text: 'a', savedAt: 1 }])
    const user = userEvent.setup()
    render(<HistoryMenu onRestore={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: /history/i })
    expect(toggle).not.toHaveAttribute('aria-haspopup')
    await user.click(toggle)
    const panel = await screen.findByRole('region', { name: /input history/i })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(toggle.getAttribute('aria-controls')).toBe(panel.id)
    ;(await screen.findByRole('button', { name: /restore: a/i })).focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('region', { name: /input history/i })).toBeNull()
    expect(toggle).toHaveFocus()
  })

  it('truncates huge entries in labels and tooltips', async () => {
    const huge = `start ${'x '.repeat(500_000)}`
    vi.spyOn(history, 'listHistory').mockResolvedValue([{ id: '1', text: huge, savedAt: 1 }])
    const user = userEvent.setup()
    render(<HistoryMenu onRestore={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /history/i }))
    const item = await screen.findByRole('button', { name: /restore: start/i })
    expect(item.getAttribute('aria-label')!.length).toBeLessThan(100)
    expect((item.getAttribute('title') ?? '').length).toBeLessThanOrEqual(501)
  })

  it('offers a "remember inputs" switch that turns saving off (and back on)', async () => {
    vi.spyOn(history, 'listHistory').mockResolvedValue([])
    localStorage.removeItem('sub:pref:inputHistory')
    const user = userEvent.setup()
    render(<HistoryMenu onRestore={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /history/i }))
    const toggle = await screen.findByRole('checkbox', { name: /remember inputs/i })
    expect(toggle).toBeChecked()
    await user.click(toggle)
    expect(localStorage.getItem('sub:pref:inputHistory')).toBe('false')
    await user.click(toggle)
    expect(localStorage.getItem('sub:pref:inputHistory')).toBe('true')
  })

  it('shows a message instead of rejecting unhandled when history cannot be read', async () => {
    vi.spyOn(history, 'listHistory').mockRejectedValue(new Error('broken'))
    const user = userEvent.setup()
    render(<HistoryMenu onRestore={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: /history/i }))
    expect(await screen.findByText(/history isn't available/i)).toBeTruthy()
  })
})
