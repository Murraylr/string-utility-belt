import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EachCard from './EachCard'

const dispatch = vi.fn()
let mockRun = { result: null }
let mockShowPreviews = false

vi.mock('@/app/ToolContext', () => ({
  useTool: () => ({ dispatch, run: mockRun, showPreviews: mockShowPreviews, state: { steps: [] } }),
  useOptionalTool: () => ({ dispatch }),
}))
// the nested list is StepList's business (tested there); here it only has to render
vi.mock('@/app/tool/StepList', () => ({ default: ({ steps, scope }) => <div data-testid="body" data-scope={scope}>{steps.length} nested</div> }))

const makeEach = (overrides = {}) => ({
  id: 'e1', type: 'each', enabled: true, split: { mode: 'lines' }, skipEmpty: true,
  steps: [{ id: 's1', utilityId: 'base64_decode', enabled: true, params: {} }],
  ...overrides,
})
const result = (over = {}) => ({ out: '', previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, items: {}, halted: false, aborted: false, ...over })

describe('<EachCard />', () => {
  beforeEach(() => {
    dispatch.mockClear()
    mockRun = { result: null }
    mockShowPreviews = false
  })

  it('shows how the input is split and renders the body as a nested list', () => {
    render(<EachCard step={makeEach()} index={1} onDelete={() => {}} onToggle={() => {}} />)
    expect(screen.getByRole('combobox', { name: 'split the input into' })).toHaveValue('lines')
    expect(screen.getByRole('group', { name: 'steps run on each line' })).toBeInTheDocument()
    expect(screen.getByTestId('body')).toHaveAttribute('data-scope', 'run-on-each step')
    expect(screen.getByRole('button', { name: 'step 2 menu' })).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'item separator' })).toBeNull()
  })

  it('switches the split mode, keeping a delimiter separator when there is one', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<EachCard step={makeEach()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    await user.selectOptions(screen.getByRole('combobox', { name: 'split the input into' }), 'json-values')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'e1', patch: { split: { mode: 'json-values' } } })
    await user.selectOptions(screen.getByRole('combobox', { name: 'split the input into' }), 'delimiter')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'e1', patch: { split: { mode: 'delimiter', separator: ',' } } })
    rerender(<EachCard step={makeEach({ split: { mode: 'delimiter', separator: ';' } })} index={0} onDelete={() => {}} onToggle={() => {}} />)
    expect(screen.getByRole('textbox', { name: 'item separator' })).toHaveValue(';')
    expect(screen.getByRole('group', { name: 'steps run on each item' })).toBeInTheDocument()
  })

  it('reverts an emptied separator instead of committing it (a delimiter must split on something)', () => {
    render(<EachCard step={makeEach({ split: { mode: 'delimiter', separator: ';' } })} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const sep = screen.getByRole('textbox', { name: 'item separator' })
    fireEvent.change(sep, { target: { value: '' } })
    fireEvent.blur(sep)
    expect(dispatch).not.toHaveBeenCalled()
    expect(sep).toHaveValue(';')
    expect(sep).toHaveAttribute('maxLength', '50')
  })

  it('toggles skipping empty items', async () => {
    const user = userEvent.setup()
    render(<EachCard step={makeEach()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const skip = screen.getByRole('checkbox', { name: 'Skip empty lines' })
    expect(skip).toBeChecked()
    await user.click(skip)
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_STEP', id: 'e1', patch: { skipEmpty: false } })
  })

  it('reports item counts, failures, the sample item and the reassembled output from the last run', () => {
    mockShowPreviews = true
    mockRun = {
      result: result({
        err: { e1: '2 of 12 lines failed (first: line 4: bad)' },
        previews: { e1: 'a\nb' },
        items: { e1: { total: 12, ran: 10, failed: 2, sample: 'line 4' } },
      }),
    }
    render(<EachCard step={makeEach()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    expect(screen.getByTestId('each-stats')).toHaveTextContent('12 lines · 2 failed')
    expect(screen.getByRole('alert')).toHaveTextContent('2 of 12 lines failed (first: line 4: bad)')
    expect(screen.getByText(/previews show line 4, the first that failed/)).toBeInTheDocument()
    expect(document.querySelector('[data-preview="each"]')).toHaveTextContent('a b')
  })

  it('explains what the error policy means for items', async () => {
    const user = userEvent.setup()
    render(<EachCard step={makeEach()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.getByText(/For each item whose steps fail/)).toBeInTheDocument()
  })

  it('unwraps, deletes and toggles', async () => {
    const user = userEvent.setup()
    const onDelete = vi.fn()
    const onToggle = vi.fn()
    const onUnwrap = vi.fn()
    render(<EachCard step={makeEach()} index={0} onDelete={onDelete} onToggle={onToggle} onUnwrap={onUnwrap} />)
    await user.click(screen.getByRole('button', { name: 'Unwrap' }))
    await user.click(screen.getByRole('button', { name: 'delete step 1' }))
    await user.click(screen.getByRole('switch', { name: 'toggle step 1' }))
    expect(onUnwrap).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
    expect(onToggle).toHaveBeenCalledWith(false)
  })
})
