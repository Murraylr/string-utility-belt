import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import FetchUrlDialog from './FetchUrlDialog'
import { fetchAsInput } from './fetchInput'

vi.mock('./fetchInput', () => ({ fetchAsInput: vi.fn() }))
const mockFetchAsInput = vi.mocked(fetchAsInput)

describe('FetchUrlDialog', () => {
  beforeEach(() => { mockFetchAsInput.mockReset() })

  it('renders nothing when closed', () => {
    render(<FetchUrlDialog open={false} onClose={vi.fn()} onFetched={vi.fn()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('is an accessible, labelled modal that focuses the URL field', async () => {
    render(<FetchUrlDialog open onClose={vi.fn()} onFetched={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    await waitFor(() => expect(screen.getByLabelText('URL')).toHaveFocus())
  })

  it('fetches on submit and reports the value, then closes', async () => {
    mockFetchAsInput.mockResolvedValue({ value: 'fetched text', contentType: 'text/plain', finalUrl: 'https://example.com/data.txt' })
    const onFetched = vi.fn()
    const onClose = vi.fn()
    render(<FetchUrlDialog open onClose={onClose} onFetched={onFetched} />)
    // fireEvent.change (not userEvent.type's per-keystroke simulation) keeps this fast and non-flaky
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com/data.txt' } })
    fireEvent.click(screen.getByRole('button', { name: /^fetch$/i }))
    await waitFor(() => expect(onFetched).toHaveBeenCalledWith('fetched text', { url: 'https://example.com/data.txt', contentType: 'text/plain' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows a readable error on failure without closing', async () => {
    mockFetchAsInput.mockRejectedValue(new Error('only http/https URLs are supported'))
    const onClose = vi.fn()
    render(<FetchUrlDialog open onClose={onClose} onFetched={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'ftp://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /^fetch$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/http/i)
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes on Escape and returns focus to the opener', async () => {
    const opener = document.createElement('button')
    opener.textContent = 'open'
    document.body.appendChild(opener)
    opener.focus()

    const onClose = vi.fn()
    const { rerender } = render(<FetchUrlDialog open={false} onClose={onClose} onFetched={vi.fn()} />)
    rerender(<FetchUrlDialog open onClose={onClose} onFetched={vi.fn()} />)
    await waitFor(() => expect(screen.getByLabelText('URL')).toHaveFocus())

    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()

    rerender(<FetchUrlDialog open={false} onClose={onClose} onFetched={vi.fn()} />)
    await waitFor(() => expect(opener).toHaveFocus())
    document.body.removeChild(opener)
  })

  it('aborts the in-flight fetch when closed', async () => {
    let capturedSignal: AbortSignal | undefined
    mockFetchAsInput.mockImplementation((_url, opts) => {
      capturedSignal = opts?.signal
      return new Promise(() => {}) // never resolves
    })
    const { rerender } = render(<FetchUrlDialog open onClose={vi.fn()} onFetched={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /^fetch$/i }))
    expect(capturedSignal?.aborted).toBe(false)
    rerender(<FetchUrlDialog open={false} onClose={vi.fn()} onFetched={vi.fn()} />)
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('aborts the in-flight fetch when unmounted while open', async () => {
    let capturedSignal: AbortSignal | undefined
    mockFetchAsInput.mockImplementation((_url, opts) => {
      capturedSignal = opts?.signal
      return new Promise(() => {})
    })
    const { unmount } = render(<FetchUrlDialog open onClose={vi.fn()} onFetched={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /^fetch$/i }))
    unmount()
    expect(capturedSignal?.aborted).toBe(true)
  })

  it('a second submit supersedes the first: the first request is aborted and never reported', async () => {
    const resolvers: Array<(v: any) => void> = []
    const signals: AbortSignal[] = []
    mockFetchAsInput.mockImplementation((_url, opts) => {
      signals.push(opts!.signal!)
      return new Promise(r => { resolvers.push(r) })
    })
    const onFetched = vi.fn()
    render(<FetchUrlDialog open onClose={vi.fn()} onFetched={onFetched} />)
    const field = screen.getByLabelText('URL')
    fireEvent.change(field, { target: { value: 'https://example.com/a' } })
    fireEvent.submit(field.closest('form')!)
    fireEvent.change(field, { target: { value: 'https://example.com/b' } })
    fireEvent.submit(field.closest('form')!)
    expect(signals).toHaveLength(2)
    expect(signals[0].aborted).toBe(true)
    resolvers[0]({ value: 'stale', contentType: 'text/plain', finalUrl: 'https://example.com/a' })
    resolvers[1]({ value: 'fresh', contentType: 'text/plain', finalUrl: 'https://example.com/b' })
    await waitFor(() => expect(onFetched).toHaveBeenCalledTimes(1))
    expect(onFetched.mock.calls[0][0]).toBe('fresh')
  })

  it('keeps Tab inside the dialog while the fetch button is disabled (loading)', async () => {
    mockFetchAsInput.mockImplementation(() => new Promise(() => {}))
    render(<FetchUrlDialog open onClose={vi.fn()} onFetched={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /^fetch$/i }))
    const cancel = screen.getByRole('button', { name: /cancel/i })
    expect(screen.getByRole('button', { name: /fetching/i })).toBeDisabled()
    cancel.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByLabelText('URL')).toHaveFocus()
  })

  it('swallows a dropped file (so the browser does not navigate to it) but lets a dragged link drop into the field', () => {
    render(<FetchUrlDialog open onClose={vi.fn()} onFetched={vi.fn()} />)
    const field = screen.getByLabelText('URL')
    const file = new File(['x'], 'x.txt')
    expect(fireEvent.drop(field, { dataTransfer: { files: [file], types: ['Files'] } })).toBe(false)
    expect(fireEvent.drop(field, { dataTransfer: { files: [], types: ['text/uri-list'] } })).toBe(true)
  })

  it('does not show a previous attempt\'s error when reopened', async () => {
    mockFetchAsInput.mockRejectedValue(new Error('that host is blocked'))
    const { rerender } = render(<FetchUrlDialog open onClose={vi.fn()} onFetched={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('URL'), { target: { value: 'https://example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /^fetch$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/blocked/)
    rerender(<FetchUrlDialog open={false} onClose={vi.fn()} onFetched={vi.fn()} />)
    rerender(<FetchUrlDialog open onClose={vi.fn()} onFetched={vi.fn()} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
