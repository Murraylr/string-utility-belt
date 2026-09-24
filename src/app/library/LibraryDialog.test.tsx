import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider, useTool } from '@/app/ToolContext'
import LibraryDialog from './LibraryDialog'
import { listEntries, saveEntry } from './storage'

const step = (id: string) => ({ id, utilityId: 'trim', enabled: true, params: {} })

function Harness({ initialSteps, initialName, onClose = () => {}, initialInput = '' }:
  { initialSteps: any[]; initialName?: string; onClose?: () => void; initialInput?: any }) {
  const [open, setOpen] = React.useState(true)
  const [round, setRound] = React.useState(0)
  return (
    <ToolProvider initialSteps={initialSteps} initialName={initialName} initialInput={initialInput}>
      <StateProbe />
      <button onClick={() => { setOpen(true); setRound(r => r + 1) }}>reopen library</button>
      {open && <LibraryDialog key={round} onClose={() => { onClose(); setOpen(false) }} />}
    </ToolProvider>
  )
}

function StateProbe() {
  const { state, input } = useTool()
  return (
    <div
      data-testid="probe"
      data-name={state.name ?? ''}
      data-library-id={state.libraryId ?? ''}
      data-step-count={state.steps.length}
      data-last-type={(state.steps[state.steps.length - 1] as any)?.type ?? 'utility'}
      data-input={typeof input === 'string' ? input : '[bytes]'}
      data-steps={JSON.stringify(state.steps)}
    />
  )
}

const probe = () => screen.getByTestId('probe')
const itemFor = (name: string) => screen.getByText(name, { selector: 'div' }).closest('li') as HTMLElement

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('LibraryDialog', () => {
  it('"Save as new" creates a library entry and links the pipeline to it', async () => {
    const user = userEvent.setup()
    render(<Harness initialSteps={[step('a')]} />)
    await user.type(screen.getByLabelText('pipeline name to save'), 'my first pipeline')
    await user.click(screen.getByRole('button', { name: 'Save as new' }))

    expect(listEntries('pipeline')).toHaveLength(1)
    await waitFor(() => expect(probe()).toHaveAttribute('data-name', 'my first pipeline'))
    expect(probe().getAttribute('data-library-id')).toBe(listEntries('pipeline')[0].id)
    // a real pipeline step (loading its lazy utility chunk) plus two userEvent.type()
    // calls comfortably exceeds vitest's default 5s per-test budget
  }, 10000)

  it('"Save" (overwrite) is disabled until the pipeline is linked to a library entry, then updates it in place', async () => {
    const user = userEvent.setup()
    render(<Harness initialSteps={[step('a')]} />)
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()

    await user.type(screen.getByLabelText('pipeline name to save'), 'v1')
    await user.click(screen.getByRole('button', { name: 'Save as new' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled())

    const nameField = screen.getByLabelText('pipeline name to save') as HTMLInputElement
    await user.clear(nameField)
    await user.type(nameField, 'v2')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(listEntries('pipeline')).toHaveLength(1) // overwrote, did not duplicate
    expect(listEntries('pipeline')[0].name).toBe('v2')
  }, 10000)

  it('loading a different pipeline without confirmation leaves the current one untouched', async () => {
    saveEntry({ kind: 'pipeline', name: 'other', steps: [step('x'), step('y')] })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<Harness initialSteps={[step('a')]} initialName="current" />)

    await user.click(screen.getByRole('button', { name: /^Load / }))
    expect(window.confirm).toHaveBeenCalled()
    expect(probe()).toHaveAttribute('data-name', 'current')
    expect(probe()).toHaveAttribute('data-step-count', '1')
  })

  it('loading after confirmation replaces the current pipeline', async () => {
    saveEntry({ kind: 'pipeline', name: 'other', steps: [step('x'), step('y')] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<Harness initialSteps={[step('a')]} initialName="current" />)

    await user.click(screen.getByRole('button', { name: /^Load / }))
    await waitFor(() => expect(probe()).toHaveAttribute('data-name', 'other'))
    expect(probe()).toHaveAttribute('data-step-count', '2')
  })

  it('loading an empty current pipeline never asks for confirmation', async () => {
    saveEntry({ kind: 'pipeline', name: 'other', steps: [step('x')] })
    const confirmSpy = vi.spyOn(window, 'confirm')
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)

    await user.click(screen.getByRole('button', { name: /^Load / }))
    expect(confirmSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(probe()).toHaveAttribute('data-name', 'other'))
  })

  it('renames an entry inline', async () => {
    saveEntry({ kind: 'pipeline', name: 'old name', steps: [step('a')] })
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)

    await user.click(screen.getByRole('button', { name: 'rename old name' }))
    const input = screen.getByRole('textbox', { name: 'rename old name' })
    await user.clear(input)
    await user.type(input, 'new name{Enter}')

    await waitFor(() => expect(screen.getByText('new name')).toBeInTheDocument())
    expect(listEntries('pipeline')[0].name).toBe('new name')
  })

  it('deletes an entry after confirmation, and does nothing if declined', async () => {
    saveEntry({ kind: 'pipeline', name: 'to delete', steps: [step('a')] })
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false)
    await user.click(screen.getByRole('button', { name: 'delete to delete' }))
    expect(listEntries('pipeline')).toHaveLength(1)

    vi.spyOn(window, 'confirm').mockReturnValueOnce(true)
    await user.click(screen.getByRole('button', { name: 'delete to delete' }))
    await waitFor(() => expect(listEntries('pipeline')).toHaveLength(0))
  })

  it('duplicates an entry as a separate library item', async () => {
    saveEntry({ kind: 'pipeline', name: 'original', steps: [step('a')] })
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)

    await user.click(screen.getByRole('button', { name: 'duplicate original' }))
    await waitFor(() => expect(listEntries('pipeline')).toHaveLength(2))
    expect(listEntries('pipeline').map(e => e.name).sort()).toEqual(['original', 'original copy'])
  })

  it('filters entries by the search box', async () => {
    saveEntry({ kind: 'pipeline', name: 'alpha', steps: [step('a')] })
    saveEntry({ kind: 'pipeline', name: 'beta', steps: [step('a')] })
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)

    await user.type(screen.getByLabelText('search pipelines'), 'alp')
    expect(screen.getByText('alpha')).toBeInTheDocument()
    expect(screen.queryByText('beta')).toBeNull()
  })

  it('inserts a macro as a MacroStep referencing the library entry', async () => {
    const macro = saveEntry({ kind: 'macro', name: 'my macro', steps: [step('m1'), step('m2')] })
    const user = userEvent.setup()
    render(<Harness initialSteps={[step('a')]} />)

    await user.click(within(screen.getByRole('tablist', { name: 'library sections' })).getByRole('tab', { name: 'Macros' }))
    await user.click(screen.getByRole('button', { name: /^Insert / }))

    await waitFor(() => expect(probe()).toHaveAttribute('data-step-count', '2'))
    expect(probe()).toHaveAttribute('data-last-type', 'macro')
    const inserted = JSON.parse(probe().getAttribute('data-steps')!)[1]
    expect(inserted).toMatchObject({ type: 'macro', name: 'my macro', macroId: macro.id, enabled: true })
    expect(inserted.steps.map((s: any) => s.utilityId)).toEqual(['trim', 'trim'])
    // fresh ids: inserting the same macro twice must never collide with the library copy
    expect(inserted.steps.map((s: any) => s.id)).not.toContain('m1')
  })

  it('Escape in the inline rename field cancels the rename and keeps the dialog open', async () => {
    saveEntry({ kind: 'pipeline', name: 'keep me', steps: [step('a')] })
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'rename keep me' }))
    const input = screen.getByRole('textbox', { name: 'rename keep me' })
    await user.clear(input)
    await user.type(input, 'changed')
    await user.keyboard('{Escape}')

    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Library' })).toBeInTheDocument()
    expect(listEntries('pipeline')[0].name).toBe('keep me')
    expect(screen.queryByRole('textbox', { name: 'rename keep me' })).toBeNull()
  })

  it('renaming the loaded pipeline also renames the pipeline in the editor', async () => {
    const entry = saveEntry({ kind: 'pipeline', name: 'before', steps: [step('a')] })
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)
    await user.click(screen.getByRole('button', { name: /^Load / }))
    await waitFor(() => expect(probe()).toHaveAttribute('data-library-id', entry.id))

    await user.click(screen.getByRole('button', { name: 'reopen library' }))
    await user.click(screen.getByRole('button', { name: 'rename before' }))
    const input = screen.getByRole('textbox', { name: 'rename before' })
    await user.clear(input)
    await user.type(input, 'after{Enter}')
    await waitFor(() => expect(probe()).toHaveAttribute('data-name', 'after'))
    expect(listEntries('pipeline')[0].name).toBe('after')
  })

  it('does not ask for confirmation when the current pipeline is the unchanged loaded entry', async () => {
    const a = saveEntry({ kind: 'pipeline', name: 'a', steps: [step('a')] })
    saveEntry({ kind: 'pipeline', name: 'b', steps: [step('b1'), step('b2')] })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)

    await user.click(within(itemFor('a')).getByRole('button', { name: /^Load / }))
    await waitFor(() => expect(probe()).toHaveAttribute('data-library-id', a.id))

    await user.click(screen.getByRole('button', { name: 'reopen library' }))
    await user.click(within(itemFor('b')).getByRole('button', { name: /^Load / }))
    expect(confirmSpy).not.toHaveBeenCalled()
    await waitFor(() => expect(probe()).toHaveAttribute('data-name', 'b'))
  })

  it('restores the input saved with a pipeline when loading it', async () => {
    saveEntry({ kind: 'pipeline', name: 'with input', steps: [step('a')], input: 'saved héllo 🎉' })
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)
    await user.click(screen.getByRole('button', { name: /^Load / }))
    await waitFor(() => expect(probe()).toHaveAttribute('data-input', 'saved héllo 🎉'))
  })

  it('saves the input only when asked to, and announces each save', async () => {
    const user = userEvent.setup()
    render(<Harness initialSteps={[step('a')]} initialInput="my input" />)
    await user.type(screen.getByLabelText('pipeline name to save'), 'no input')
    await user.click(screen.getByRole('button', { name: 'Save as new' }))
    expect(listEntries('pipeline')[0].input).toBeUndefined()
    expect(screen.getByText(/saved “no input”/i)).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: 'save input with pipeline' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(listEntries('pipeline')).toHaveLength(1)
    expect(listEntries('pipeline')[0].input).toBe('my input')
  }, 10000)

  it('keeps the saved input when overwriting a pipeline that was loaded with one', async () => {
    saveEntry({ kind: 'pipeline', name: 'with input', steps: [step('a')], input: 'keep me' })
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)
    await user.click(screen.getByRole('button', { name: /^Load / }))
    await waitFor(() => expect(probe()).toHaveAttribute('data-name', 'with input'))

    await user.click(screen.getByRole('button', { name: 'reopen library' }))
    expect(screen.getByRole('checkbox', { name: 'save input with pipeline' })).toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(listEntries('pipeline')[0].input).toBe('keep me')
  })

  it('shows a readable error instead of throwing when storage is full', async () => {
    const user = userEvent.setup()
    render(<Harness initialSteps={[step('a')]} />)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('quota', 'QuotaExceededError') })
    await user.click(screen.getByRole('button', { name: 'Save as new' }))
    expect(screen.getByRole('alert')).toHaveTextContent(/storage is full or disabled/i)
    expect(probe()).toHaveAttribute('data-library-id', '')
  })

  it('deleting the loaded pipeline unlinks the editor from it', async () => {
    const entry = saveEntry({ kind: 'pipeline', name: 'linked', steps: [step('a')] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)
    await user.click(screen.getByRole('button', { name: /^Load / }))
    await waitFor(() => expect(probe()).toHaveAttribute('data-library-id', entry.id))

    await user.click(screen.getByRole('button', { name: 'reopen library' }))
    await user.click(screen.getByRole('button', { name: 'delete linked' }))
    await waitFor(() => expect(probe()).toHaveAttribute('data-library-id', ''))
    expect(listEntries()).toHaveLength(0)
  })

  it('imports a file, quarantining code steps, and reports added/skipped', async () => {
    const existing = saveEntry({ kind: 'pipeline', name: 'existing', steps: [step('a')] })
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)
    const file = new File([JSON.stringify({
      v: 2,
      entries: [
        { id: existing.id, kind: 'pipeline', name: 'existing', steps: [step('a')] },
        { id: 'new1', kind: 'pipeline', name: 'imported code', steps: [{ id: 'c', utilityId: 'custom_js', enabled: true, params: { code: 'return 1' } }] },
      ],
    })], 'lib.json', { type: 'application/json' })
    await user.upload(screen.getByLabelText('import library file'), file)

    expect(await screen.findByText(/Imported 1, skipped 1/)).toBeInTheDocument()
    const imported = listEntries('pipeline').find(e => e.id === 'new1')!
    expect(imported.steps[0].enabled).toBe(false)
  })

  it('still renders the list when a stored entry carries a nonsense timestamp', () => {
    localStorage.setItem('sub:library', JSON.stringify({
      v: 2, entries: [{ id: 'x', kind: 'pipeline', name: 'odd dates', steps: [], createdAt: 1e300, updatedAt: 1e300 }],
    }))
    render(<Harness initialSteps={[]} />)
    expect(screen.getByText('odd dates')).toBeInTheDocument()
  })

  it('returns keyboard focus to the rename button after Enter or Escape ends an inline rename', async () => {
    saveEntry({ kind: 'pipeline', name: 'focus me', steps: [step('a')] })
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)

    await user.click(screen.getByRole('button', { name: 'rename focus me' }))
    await user.keyboard('{Escape}')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'rename focus me' }))

    await user.keyboard('{Enter}') // the focused rename button starts a new rename
    const input = screen.getByRole('textbox', { name: 'rename focus me' })
    await user.clear(input)
    await user.type(input, 'renamed{Enter}')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'rename renamed' })))
  })

  it('keeps keyboard focus inside the dialog after deleting an entry', async () => {
    saveEntry({ kind: 'pipeline', name: 'gone soon', steps: [step('a')] })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)
    await user.click(screen.getByRole('button', { name: 'delete gone soon' }))
    await waitFor(() => expect(listEntries()).toHaveLength(0))
    expect(screen.getByRole('dialog', { name: 'Library' }).contains(document.activeElement)).toBe(true)
  })

  it('refuses a file far larger than any library could be without reading it into memory', async () => {
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)
    const huge = new File(['{}'], 'huge.json', { type: 'application/json' })
    Object.defineProperty(huge, 'size', { value: 200 * 1024 * 1024 })
    // jsdom's File has no .text(), so the dialog reads through FileReader
    const read = vi.spyOn(FileReader.prototype, 'readAsText')
    await user.upload(screen.getByLabelText('import library file'), huge)
    expect(await screen.findByRole('alert')).toHaveTextContent(/too large/i)
    expect(read).not.toHaveBeenCalled()
  })

  it('reports a readable error for a file that is not a library', async () => {
    const user = userEvent.setup()
    render(<Harness initialSteps={[]} />)
    await user.upload(screen.getByLabelText('import library file'), new File(['{nope'], 'bad.json', { type: 'application/json' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/not valid JSON/i)
  })

  it('rings the search box wrapper while its unstyled input has focus (it has no focus style of its own)', () => {
    render(<Harness initialSteps={[step('a')]} />)
    const search = screen.getByRole('textbox', { name: 'search pipelines' })
    expect(search.className).toContain('outline-none')
    const wrapper = search.parentElement as HTMLElement
    expect(wrapper.className).toContain('focus-within:ring-2')
    expect(wrapper.className).toContain('focus-within:ring-primary-500')
  })
})
