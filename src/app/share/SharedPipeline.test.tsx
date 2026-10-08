import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { encodeShare } from '@/core/serialize'
import { loadState, saveState } from '@/lib/persist'
import { listEntries } from '@/app/library/storage'
import SharedPipeline from './SharedPipeline'

// The real editor page is owned (and re-shaped) by other features; this suite is about
// what SharedPipeline does around it, so a minimal stand-in exposes the banner, the
// input the app test relies on, and one real edit (a reducer dispatch).
vi.mock('@/app/tool/ToolPage', async () => {
  const { useTool } = await import('@/app/ToolContext')
  return {
    default: function ToolPageStub({ banner }: { banner?: React.ReactNode }) {
      const { dispatch, state } = useTool()
      return (
        <>
          {banner}
          <textarea placeholder="type or paste your text here…" aria-label="input" />
          <button onClick={() => dispatch({ type: 'ADD_BRANCH' })}>branch</button>
          {/* what loading a library entry from the toolbar does */}
          <button onClick={() => dispatch({ type: 'LOAD', steps: [{ id: 'lib-step', utilityId: 'upper', enabled: true, params: {} }], name: 'from library', libraryId: 'lib_1' })}>load entry</button>
          <output data-testid="step-count">{state.steps.length}</output>
        </>
      )
    },
  }
})

const step = (id: string, utilityId = 'trim') => ({ id, utilityId, enabled: true, params: {} })

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SharedPipeline', () => {
  it('shows a readable alert and the normal editor when the payload does not decode', () => {
    render(<SharedPipeline payload="not-a-valid-payload" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('type or paste your text here…')).toBeInTheDocument()
  })

  it('renders the pipeline name in the banner', () => {
    const payload = encodeShare({ v: 2, name: 'shared demo', steps: [step('a')] })
    render(<SharedPipeline payload={payload} />)
    expect(screen.getByText(/Opened a shared pipeline: shared demo/)).toBeInTheDocument()
  })

  it('autosaves a distinct previous pipeline once', async () => {
    saveState({ steps: [step('prev1'), step('prev2')], showPreviews: true })
    const payload = encodeShare({ v: 2, steps: [step('shared', 'upper')] })
    render(<SharedPipeline payload={payload} />)

    await waitFor(() => expect(screen.getByText(/Your previous pipeline was saved to your library/)).toBeInTheDocument())
    expect(listEntries('pipeline')).toHaveLength(1)
    expect(listEntries('pipeline')[0].name).toMatch(/^Autosave — /)
  })

  it('never creates a second autosave for the same previous pipeline, even across a fresh mount', async () => {
    saveState({ steps: [step('prev1')], showPreviews: true })
    const payload = encodeShare({ v: 2, steps: [step('shared', 'upper')] })
    const { unmount } = render(<SharedPipeline payload={payload} />)
    await waitFor(() => expect(listEntries('pipeline')).toHaveLength(1))
    unmount()

    render(<SharedPipeline payload={payload} />)
    await Promise.resolve()
    expect(listEntries('pipeline')).toHaveLength(1)
  })

  it('does not autosave when there is no previous pipeline', () => {
    const payload = encodeShare({ v: 2, steps: [step('shared')] })
    render(<SharedPipeline payload={payload} />)
    expect(screen.queryByText(/saved to your library/)).toBeNull()
    expect(listEntries('pipeline')).toHaveLength(0)
  })

  it('does not autosave when the previous pipeline is identical to the shared one', () => {
    saveState({ steps: [step('shared')], showPreviews: true })
    const payload = encodeShare({ v: 2, steps: [step('shared')] })
    render(<SharedPipeline payload={payload} />)
    expect(listEntries('pipeline')).toHaveLength(0)
  })

  it('shows a quarantine warning when a code step was disabled', () => {
    const payload = encodeShare({ v: 2, steps: [{ id: 's1', utilityId: 'custom_js', enabled: true, params: {} }] })
    render(<SharedPipeline payload={payload} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/custom code/i)
  })

  it('shows no quarantine warning for an ordinary pipeline', () => {
    const payload = encodeShare({ v: 2, steps: [step('a')] })
    render(<SharedPipeline payload={payload} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('"Open in editor" saves the shared pipeline as the working one and clears the share hash', async () => {
    const user = userEvent.setup()
    const payload = encodeShare({ v: 2, name: 'shared demo', steps: [step('shared')] })
    render(<SharedPipeline payload={payload} />)

    await user.click(screen.getByRole('button', { name: 'Open in editor' }))

    expect(loadState().steps).toEqual([step('shared')])
    expect(loadState().name).toBe('shared demo')
    expect(location.hash).toBe('#/')
  })

  it('shows the autosave notice under React.StrictMode (double render / double effects)', async () => {
    saveState({ steps: [step('prev1')], showPreviews: true })
    const payload = encodeShare({ v: 2, steps: [step('shared', 'upper')] })
    render(<React.StrictMode><SharedPipeline payload={payload} /></React.StrictMode>)
    expect(await screen.findByText(/Your previous pipeline was saved to your library/)).toBeInTheDocument()
    expect(listEntries('pipeline')).toHaveLength(1)
  })

  it('"Open in editor" keeps the edits made to the shared pipeline before clicking it', async () => {
    const user = userEvent.setup()
    const payload = encodeShare({ v: 2, name: 'shared demo', steps: [step('shared')] })
    render(<SharedPipeline payload={payload} />)

    await user.click(screen.getByRole('button', { name: /branch/i }))
    await user.click(screen.getByRole('button', { name: 'Open in editor' }))

    const saved = loadState().steps
    expect(saved).toHaveLength(2)
    expect(saved[0]).toMatchObject({ id: 'shared', utilityId: 'trim' })
    expect(saved[1]).toMatchObject({ type: 'branch' })
  })

  it('"Open in editor" writes a schema v2 document', async () => {
    const user = userEvent.setup()
    render(<SharedPipeline payload={encodeShare({ v: 2, steps: [step('shared')] })} />)
    await user.click(screen.getByRole('button', { name: 'Open in editor' }))
    expect(JSON.parse(localStorage.getItem('string-utility-belt')!).v).toBe(2)
  })

  it('"Open in editor" keeps the link to a library entry loaded while the shared pipeline was open', async () => {
    const user = userEvent.setup()
    render(<SharedPipeline payload={encodeShare({ v: 2, steps: [step('shared')] })} />)
    await user.click(screen.getByRole('button', { name: 'load entry' }))
    await user.click(screen.getByRole('button', { name: 'Open in editor' }))
    expect(loadState()).toMatchObject({ name: 'from library', libraryId: 'lib_1' })
  })

  it('still opens the link, with a warning, when the autosave cannot be written', async () => {
    saveState({ steps: [step('prev1')], showPreviews: true })
    const payload = encodeShare({ v: 2, name: 'shared demo', steps: [step('shared', 'upper')] })
    const realSetItem = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === 'sub:library') throw new DOMException('quota', 'QuotaExceededError')
      return realSetItem.call(this, key, value)
    })
    render(<SharedPipeline payload={payload} />)
    expect(screen.getByText(/Opened a shared pipeline: shared demo/)).toBeInTheDocument()
    expect(await screen.findByText(/could not save your previous pipeline/i)).toBeInTheDocument()
  })
})
