import { useState } from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import FetchUrlForm, { type FetchUrlFormProps } from './FetchUrlForm'
import { fetchAsInput } from './fetchInput'

vi.mock('./fetchInput', () => ({ fetchAsInput: vi.fn() }))
const mockFetchAsInput = vi.mocked(fetchAsInput)

/** The form with its URL state held the way the panel holds it. */
function Harness(props: Partial<FetchUrlFormProps>) {
  const [url, setUrl] = useState('')
  return <FetchUrlForm url={url} onUrlChange={setUrl} onFetched={vi.fn()} onError={vi.fn()} onCancel={vi.fn()} {...props} />
}

const field = () => screen.getByLabelText('URL to fetch')
const fetchButton = () => screen.getByRole('button', { name: /^fetch$/i })

describe('FetchUrlForm', () => {
  beforeEach(() => { mockFetchAsInput.mockReset() })

  it('focuses the URL field when it opens', () => {
    render(<Harness />)
    expect(field()).toHaveFocus()
    expect(field()).toHaveAttribute('placeholder', 'https://example.com/data.json')
  })

  it('fetches on submit and reports the value', async () => {
    mockFetchAsInput.mockResolvedValue({ value: 'fetched text', contentType: 'text/plain', finalUrl: 'https://example.com/data.txt' })
    const onFetched = vi.fn()
    render(<Harness onFetched={onFetched} />)
    // fireEvent.change (not userEvent.type's per-keystroke simulation) keeps this fast and non-flaky
    fireEvent.change(field(), { target: { value: 'https://example.com/data.txt' } })
    fireEvent.click(fetchButton())
    await waitFor(() => expect(onFetched).toHaveBeenCalledWith('fetched text', { url: 'https://example.com/data.txt', contentType: 'text/plain' }))
    expect(mockFetchAsInput.mock.calls[0][0]).toBe('https://example.com/data.txt')
  })

  it('reports a readable error, and clears it when the next attempt starts', async () => {
    mockFetchAsInput.mockRejectedValueOnce(new Error('only http/https URLs are supported'))
    mockFetchAsInput.mockImplementationOnce(() => new Promise(() => {}))
    const onError = vi.fn()
    const onFetched = vi.fn()
    render(<Harness onError={onError} onFetched={onFetched} />)
    fireEvent.change(field(), { target: { value: 'ftp://example.com' } })
    fireEvent.click(fetchButton())
    await waitFor(() => expect(onError).toHaveBeenLastCalledWith('only http/https URLs are supported'))
    expect(onFetched).not.toHaveBeenCalled()
    fireEvent.click(fetchButton())
    expect(onError).toHaveBeenLastCalledWith(null)
  })

  it('shows progress and a Cancel button while fetching; Cancel asks to close', async () => {
    mockFetchAsInput.mockImplementation(() => new Promise(() => {}))
    const onCancel = vi.fn()
    render(<Harness onCancel={onCancel} />)
    expect(screen.queryByRole('button', { name: /cancel/i })).toBeNull()
    fireEvent.change(field(), { target: { value: 'https://example.com' } })
    fireEvent.click(fetchButton())
    expect(screen.getByRole('button', { name: /fetching/i })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/fetching/i)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('asks to close on Escape, without letting the key reach the page', () => {
    const onCancel = vi.fn()
    const onPageKey = vi.fn()
    document.addEventListener('keydown', onPageKey)
    try {
      render(<Harness onCancel={onCancel} />)
      fireEvent.keyDown(field(), { key: 'Escape' })
      expect(onCancel).toHaveBeenCalled()
      expect(onPageKey).not.toHaveBeenCalled()
    } finally {
      document.removeEventListener('keydown', onPageKey)
    }
  })

  it('aborts the in-flight fetch when unmounted (closed)', () => {
    let capturedSignal: AbortSignal | undefined
    mockFetchAsInput.mockImplementation((_url, opts) => {
      capturedSignal = opts?.signal
      return new Promise(() => {}) // never resolves
    })
    const { unmount } = render(<Harness />)
    fireEvent.change(field(), { target: { value: 'https://example.com' } })
    fireEvent.click(fetchButton())
    expect(capturedSignal?.aborted).toBe(false)
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
    render(<Harness onFetched={onFetched} />)
    fireEvent.change(field(), { target: { value: 'https://example.com/a' } })
    fireEvent.submit(field().closest('form')!)
    fireEvent.change(field(), { target: { value: 'https://example.com/b' } })
    fireEvent.submit(field().closest('form')!)
    expect(signals).toHaveLength(2)
    expect(signals[0].aborted).toBe(true)
    resolvers[0]({ value: 'stale', contentType: 'text/plain', finalUrl: 'https://example.com/a' })
    resolvers[1]({ value: 'fresh', contentType: 'text/plain', finalUrl: 'https://example.com/b' })
    await waitFor(() => expect(onFetched).toHaveBeenCalledTimes(1))
    expect(onFetched.mock.calls[0][0]).toBe('fresh')
  })

  it('keeps a paste inside the row', () => {
    const onPaste = vi.fn()
    render(<div onPaste={onPaste}><Harness /></div>)
    fireEvent.paste(field(), { clipboardData: { files: [], getData: () => 'https://example.com' } })
    expect(onPaste).not.toHaveBeenCalled()
  })
})
