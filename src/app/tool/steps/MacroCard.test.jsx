import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MacroCard from './MacroCard'

const dispatch = vi.fn()
const saveEntry = vi.fn()
let mockRun = { result: null }
let mockShowPreviews = false

vi.mock('@/app/ToolContext', () => ({
  useTool: () => ({ dispatch, run: mockRun, showPreviews: mockShowPreviews, state: { steps: [] } }),
  useOptionalTool: () => ({ dispatch }),
}))
vi.mock('@/app/library/storage', () => ({ saveEntry: (...args) => saveEntry(...args) }))

vi.setConfig({ testTimeout: 20000 })

function makeMacro(overrides = {}) {
  return {
    id: 'm1', type: 'macro', enabled: true, name: 'my macro',
    steps: [{ id: 's1', utilityId: 'trim', enabled: true, params: {} }],
    ...overrides,
  }
}

const result = (over = {}) => ({ out: '', previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: false, ...over })

describe('<MacroCard />', () => {
  beforeEach(() => {
    dispatch.mockClear()
    saveEntry.mockReset()
    mockRun = { result: null }
    mockShowPreviews = false
  })

  it('renames the macro as one edit when the field is committed, not per keystroke', async () => {
    const user = userEvent.setup()
    render(<MacroCard step={makeMacro()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const name = screen.getByLabelText('macro name')
    await user.clear(name)
    await user.type(name, 'renamed')
    expect(dispatch).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_STEP', id: 'm1', patch: { name: 'renamed' } })
  })

  it('commits a rename on blur, and ignores a blank name', () => {
    render(<MacroCard step={makeMacro()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const name = screen.getByLabelText('macro name')
    fireEvent.change(name, { target: { value: '   ' } })
    fireEvent.blur(name)
    expect(dispatch).not.toHaveBeenCalled()
    expect(name).toHaveValue('my macro')
    fireEvent.change(name, { target: { value: 'other' } })
    fireEvent.blur(name)
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_STEP', id: 'm1', patch: { name: 'other' } })
  })

  it('Escape reverts an uncommitted rename', async () => {
    const user = userEvent.setup()
    render(<MacroCard step={makeMacro()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const name = screen.getByLabelText('macro name')
    await user.type(name, ' 2')
    await user.keyboard('{Escape}')
    expect(name).toHaveValue('my macro')
    fireEvent.blur(name)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('expands and collapses the body', async () => {
    const user = userEvent.setup()
    render(<MacroCard step={makeMacro()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    expect(document.querySelector('[data-step-id="s1"]')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Show steps' }))
    expect(document.querySelector('[data-step-id="s1"]')).not.toBeNull()
    await user.click(screen.getByRole('button', { name: 'Hide steps' }))
    expect(document.querySelector('[data-step-id="s1"]')).toBeNull()
    expect(screen.getByRole('button', { name: 'Show steps' })).toBeTruthy()
  })

  it('unwraps the macro', async () => {
    const user = userEvent.setup()
    render(<MacroCard step={makeMacro()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Unwrap' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'UNWRAP', id: 'm1' })
  })

  it('saves the macro to the library with a deep clone and confirms via aria-live', async () => {
    const user = userEvent.setup()
    render(<MacroCard step={makeMacro()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Save to library' }))
    expect(saveEntry).toHaveBeenCalledTimes(1)
    const arg = saveEntry.mock.calls[0][0]
    expect(arg.kind).toBe('macro')
    expect(arg.name).toBe('my macro')
    expect(arg.steps).toHaveLength(1)
    expect(arg.steps[0].id).not.toBe('s1') // cloned with a fresh id
    const live = await screen.findByText('saved "my macro" to library')
    expect(live.closest('[aria-live]')).not.toBeNull()
  })

  it('reports a failed library save (e.g. storage full) instead of throwing', async () => {
    const user = userEvent.setup()
    saveEntry.mockImplementation(() => { throw new Error('QuotaExceededError') })
    render(<MacroCard step={makeMacro()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Save to library' }))
    expect(await screen.findByText(/could not save/i)).toBeTruthy()
  })

  it('shows the macro\'s output with a copy control when previews are on', () => {
    mockShowPreviews = true
    mockRun = { result: result({ previews: { m1: 'MACRO-OUT' } }) }
    render(<MacroCard step={makeMacro()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    expect(screen.getByText('MACRO-OUT')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'copy' })).toBeTruthy()
  })

  it('edits the macro\'s run condition and shows skipped/error states', async () => {
    const user = userEvent.setup()
    mockRun = { result: result({ skipped: { m1: 'halted' } }) }
    render(<MacroCard step={makeMacro({ onError: 'empty' })} index={0} onDelete={() => {}} onToggle={() => {}} />)
    expect(screen.getByText('Not run: the pipeline stopped at an earlier step.')).toBeTruthy()
    expect(screen.getByText('empty on error')).toBeTruthy()
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    await user.selectOptions(screen.getByLabelText('run condition'), 'type')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'm1', patch: { condition: { kind: 'type', type: 'string', negate: false } } })
  })
})
