import { useState } from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import BranchCard from './BranchCard'

let onDispatch = () => {}
const dispatch = vi.fn(a => onDispatch(a))
let mockRun = { result: null }
let mockShowPreviews = false

vi.mock('@/app/ToolContext', () => ({
  useTool: () => ({ dispatch, run: mockRun, showPreviews: mockShowPreviews, state: { steps: [] } }),
  useOptionalTool: () => ({ dispatch }),
}))

vi.setConfig({ testTimeout: 20000 })

function makeBranch(overrides = {}) {
  return {
    id: 'b1', type: 'branch', enabled: true,
    branches: [[{ id: 'l1s1', utilityId: 'trim', enabled: true, params: {} }], []],
    merge: { mode: 'concat', separator: '\n' },
    ...overrides,
  }
}

const result = (over = {}) => ({ out: '', previews: {}, inputs: {}, err: {}, timings: {}, skipped: {}, halted: false, aborted: false, ...over })

/** Holds the branch in state and applies UPDATE_STEP patches, like the real store. */
function Stateful({ initial }) {
  const [step, setStep] = useState(initial)
  onDispatch = a => {
    if (a.type === 'UPDATE_STEP') {
      setStep(s => {
        const next = { ...s, ...a.patch }
        for (const [k, v] of Object.entries(a.patch)) if (v === undefined) delete next[k]
        return next
      })
    }
  }
  return <BranchCard step={step} index={0} onDelete={() => {}} onToggle={() => {}} />
}

describe('<BranchCard />', () => {
  beforeEach(() => {
    dispatch.mockClear()
    onDispatch = () => {}
    mockRun = { result: null }
    mockShowPreviews = false
  })

  it('shows the separator escaped, and dispatches an unescaped one on edit', () => {
    render(<BranchCard step={makeBranch()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const sep = screen.getByLabelText('merge separator')
    expect(sep).toHaveValue('\\n')
    fireEvent.change(sep, { target: { value: '\\t' } })
    fireEvent.blur(sep)
    expect(dispatch).toHaveBeenCalledWith({ type: 'UPDATE_STEP', id: 'b1', patch: { merge: { mode: 'concat', separator: '\t' } } })
  })

  it('lets the user type an escape sequence key by key, committing once per edit', async () => {
    const user = userEvent.setup()
    render(<Stateful initial={makeBranch()} />)
    const sep = screen.getByLabelText('merge separator')
    await user.clear(sep)
    await user.type(sep, '\\t')
    expect(sep).toHaveValue('\\t')
    // nothing stored mid-edit (a lone "\" is not yet an escape): one undo entry per edit
    expect(dispatch).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'b1', patch: { merge: { mode: 'concat', separator: '\t' } } })
    expect(sep).toHaveValue('\\t')
    await user.clear(sep)
    await user.type(sep, ' | ')
    await user.tab()
    expect(dispatch).toHaveBeenCalledTimes(2)
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'b1', patch: { merge: { mode: 'concat', separator: ' | ' } } })
  })

  it('Escape reverts an uncommitted separator', async () => {
    const user = userEvent.setup()
    render(<Stateful initial={makeBranch()} />)
    const sep = screen.getByLabelText('merge separator')
    await user.type(sep, 'xyz')
    await user.keyboard('{Escape}')
    expect(sep).toHaveValue('\\n')
    await user.tab()
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('switches to pick mode with a lane select, and json mode drops the separator', async () => {
    const user = userEvent.setup()
    render(<Stateful initial={makeBranch()} />)
    await user.selectOptions(screen.getByLabelText('Merge lanes'), 'pick')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'b1', patch: { merge: { mode: 'pick', index: 0 } } })
    expect(screen.getByLabelText('Lane')).toBeTruthy()
    expect(screen.queryByLabelText('merge separator')).toBeNull()
    await user.selectOptions(screen.getByLabelText('Merge lanes'), 'json')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'b1', patch: { merge: { mode: 'json' } } })
    expect(screen.queryByLabelText('Lane')).toBeNull()
    expect(screen.queryByLabelText('merge separator')).toBeNull()
  })

  it('lets a pick mode branch choose its lane', async () => {
    const user = userEvent.setup()
    render(<BranchCard step={makeBranch({ merge: { mode: 'pick', index: 0 } })} index={0} onDelete={() => {}} onToggle={() => {}} />)
    await user.selectOptions(screen.getByLabelText('Lane'), 'Lane 2')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'b1', patch: { merge: { mode: 'pick', index: 1 } } })
  })

  it('shows a picked lane that no longer exists instead of silently showing lane 1', () => {
    render(<BranchCard step={makeBranch({ merge: { mode: 'pick', index: 3 } })} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const select = screen.getByLabelText('Lane')
    expect(select).toHaveValue('3')
    expect(within(select).getByRole('option', { name: /Lane 4.*missing/ })).toBeTruthy()
  })

  it('adds and removes lanes', async () => {
    const user = userEvent.setup()
    render(<BranchCard step={makeBranch()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    await user.click(screen.getByRole('button', { name: 'add a lane to step 1' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'ADD_LANE', id: 'b1' })
    await user.click(screen.getByRole('button', { name: 'remove lane 1' }))
    expect(dispatch).toHaveBeenCalledWith({ type: 'REMOVE_LANE', id: 'b1', lane: 0 })
  })

  it('does not offer to remove the only lane', () => {
    render(<BranchCard step={makeBranch({ branches: [[]] })} index={0} onDelete={() => {}} onToggle={() => {}} />)
    expect(screen.queryByRole('button', { name: /remove lane/ })).toBeNull()
  })

  it('labels each lane\'s add-step select and adds into that lane', async () => {
    const user = userEvent.setup()
    render(<BranchCard step={makeBranch()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const add = screen.getByLabelText('add a step to lane 2')
    await user.selectOptions(add, 'reverse')
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'ADD_STEP', utilityId: 'reverse', target: { parentId: 'b1', lane: 1 } }))
  })

  it('shows each lane\'s last-step preview when previews are on', () => {
    mockShowPreviews = true
    mockRun = { result: result({ previews: { l1s1: 'TRIMMED' } }) }
    render(<BranchCard step={makeBranch()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    expect(screen.getByText('Lane 1 output')).toBeTruthy()
    expect(screen.getAllByText('TRIMMED').length).toBeGreaterThan(0)
  })

  it('shows an empty lane\'s output as the branch input, and an errored last step\'s passthrough', () => {
    mockShowPreviews = true
    mockRun = { result: result({ inputs: { b1: 'BRANCH-IN', l1s1: 'LANE1-IN' }, err: { l1s1: 'boom' } }) }
    render(<BranchCard step={makeBranch()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const lane1 = screen.getByText('Lane 1 output').closest('[data-preview]')
    expect(lane1.textContent).toContain('LANE1-IN')
    const lane2 = screen.getByText('Lane 2 output').closest('[data-preview]')
    expect(lane2.textContent).toContain('BRANCH-IN')
  })

  it('shows the merged branch output with a copy control when previews are on', () => {
    mockShowPreviews = true
    mockRun = { result: result({ previews: { b1: 'MERGED', l1s1: 'x' } }) }
    render(<BranchCard step={makeBranch()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    const merged = screen.getByText('Merged output').closest('[data-preview]')
    expect(merged.textContent).toContain('MERGED')
    expect(within(merged).getByRole('button', { name: 'copy' })).toBeTruthy()
  })

  it('edits the branch\'s run condition and error policy, and shows chips for them', async () => {
    const user = userEvent.setup()
    // empty lanes, so the only "advanced" toggle is the branch's own
    render(<Stateful initial={makeBranch({ branches: [[], []] })} />)
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    await user.selectOptions(screen.getByLabelText('run condition'), 'nonEmpty')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'b1', patch: { condition: { kind: 'nonEmpty', negate: false } } })
    await user.selectOptions(screen.getByLabelText('on error'), 'stop')
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'UPDATE_STEP', id: 'b1', patch: { onError: 'stop' } })
    expect(screen.getByText('if not empty')).toBeTruthy()
    expect(screen.getByText('stops on error')).toBeTruthy()
  })

  it('labels a skipped branch', () => {
    mockRun = { result: result({ skipped: { b1: 'condition' } }) }
    render(<BranchCard step={makeBranch()} index={0} onDelete={() => {}} onToggle={() => {}} />)
    expect(screen.getByText(/^Skipped: the run condition/)).toBeTruthy()
  })
})
