import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider, useTool } from '@/app/ToolContext'
import { listEntries } from '@/app/library/storage'
import StepList from './StepList'
import BulkToggle from './steps/BulkToggle'

// Real framer-motion drag physics can't be simulated in jsdom (no real layout).
// The stub keeps the same prop contract StepList relies on — `values`/`onReorder`
// (live order) and each Item's `onDragEnd` (commit) — as clickable test hooks, so
// the tests exercise StepList's own commit-on-end logic rather than the library's.
vi.mock('framer-motion', () => ({
  Reorder: {
    Group: ({ children, values, onReorder }) => (
      <div data-testid="reorder-group">
        <button type="button" data-testid="simulate-live-reorder" onClick={() => onReorder([...values].reverse())} />
        {children}
      </div>
    ),
    Item: ({ children, value, onDragEnd, layout }) => (
      <div data-testid={`reorder-item-${value}`} data-layout={String(layout)}>
        {children}
        <button type="button" data-testid={`simulate-drag-end-${value}`} onClick={() => onDragEnd?.()} />
      </div>
    ),
  },
  AnimatePresence: ({ children }) => children,
  useDragControls: () => ({ start: () => {} }),
  useReducedMotion: () => false,
}))

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

const step = (id, utilityId = 'trim') => ({ id, utilityId, enabled: true, params: {} })

/** The store's step ids as a nested tree: branches as arrays of lanes, macros as {id: [...]}. */
const idTree = steps => steps.map(s => (s.type === 'branch' ? { [s.id]: s.branches.map(idTree) } : s.type === 'macro' ? { [s.id]: idTree(s.steps) } : s.id))

function Harness({ extra }) {
  const { state, canUndo } = useTool()
  return (
    <>
      <div data-testid="can-undo">{String(canUndo)}</div>
      <div data-testid="store">{JSON.stringify(idTree(state.steps))}</div>
      <div data-testid="enabled">{JSON.stringify(flatEnabled(state.steps))}</div>
      {extra}
      <StepList steps={state.steps} />
    </>
  )
}

const flatEnabled = steps => steps.flatMap(s => [s.enabled !== false, ...(s.type === 'branch' ? s.branches.flatMap(flatEnabled) : s.type === 'macro' ? flatEnabled(s.steps) : [])])
const storeTree = () => JSON.parse(screen.getByTestId('store').textContent)

function renderTool(initialSteps, extra) {
  return render(
    <ToolProvider initialSteps={initialSteps} persist={false}>
      <Harness extra={extra} />
    </ToolProvider>,
  )
}

const stepOrder = () => screen.getAllByText(/^step \d+$/).map(el => el.closest('[data-step-id]')?.getAttribute('data-step-id'))

/**
 * Browsers apply the HTML focus-fixup rule when a node *containing* the focused element
 * is moved or removed (React moves a keyed row with insertBefore/appendChild), so focus
 * drops to <body>. jsdom only does that when the moved node IS the focused element, which
 * hides focus loss on reorder. Emulate the browser behaviour for the tests that need it.
 */
function emulateBrowserFocusFixup() {
  for (const name of ['insertBefore', 'appendChild']) {
    const original = Node.prototype[name]
    vi.spyOn(Node.prototype, name).mockImplementation(function (node, ...rest) {
      const active = document.activeElement
      if (node instanceof Node && node.isConnected && active && active !== document.body && node.contains(active)) active.blur()
      return original.call(this, node, ...rest)
    })
  }
}

// This file mounts a real ToolProvider (reducer + pipeline runner) and drives
// several userEvent interactions per test, which can run well past vitest's 5s
// default on a loaded machine.
vi.setConfig({ testTimeout: 20000 })

describe('<StepList /> reordering', () => {
  it('Alt+ArrowDown on a focused drag handle moves the step down and keeps focus', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b')])
    expect(stepOrder()).toEqual(['a', 'b'])

    const handle = screen.getByRole('button', { name: /reorder step 1/i })
    handle.focus()
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')

    expect(stepOrder()).toEqual(['b', 'a'])
    expect(document.activeElement).toBe(handle)
    expect(screen.getByTestId('can-undo').textContent).toBe('true')
  })

  it('keeps focus on the moved card\'s handle even when the browser drops focus on DOM moves', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b'), step('c')])
    emulateBrowserFocusFixup()

    // moving the first row down: React re-inserts that row's DOM node
    const handleA = screen.getByRole('button', { name: /reorder step 1/i })
    handleA.focus()
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(stepOrder()).toEqual(['b', 'a', 'c'])
    expect(document.activeElement).toBe(handleA)

    await user.keyboard('{Alt>}{ArrowDown}{/Alt}')
    expect(stepOrder()).toEqual(['b', 'c', 'a'])
    expect(document.activeElement).toBe(handleA)

    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(stepOrder()).toEqual(['b', 'a', 'c'])
    expect(document.activeElement).toBe(handleA)
    // the new position is announced for screen-reader users
    expect(screen.getByText('moved step to position 2 of 3')).toBeTruthy()
  })

  it('returns focus to the moved card\'s menu button after "Move down" from its menu', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b')])
    emulateBrowserFocusFixup()
    const trigger = screen.getByRole('button', { name: 'step 1 menu' })
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Move down' }))
    expect(stepOrder()).toEqual(['b', 'a'])
    expect(document.activeElement).toBe(trigger)
  })

  it('keeps focus on a header move button that moved its card', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b'), step('c')])
    emulateBrowserFocusFixup()
    const down = screen.getByRole('button', { name: 'move step 1 down' })
    down.focus()
    await user.keyboard('{Enter}')
    expect(stepOrder()).toEqual(['b', 'a', 'c'])
    expect(document.activeElement).toBe(down)
  })

  it('hands focus to the twin move button when a header move lands on an edge (the pressed one is now disabled)', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b')])
    const down = screen.getByRole('button', { name: 'move step 1 down' })
    down.focus()
    await user.keyboard('{Enter}')
    expect(stepOrder()).toEqual(['b', 'a'])
    expect(down).toBeDisabled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'move step 2 up' }))
    await user.keyboard('{Enter}')
    expect(stepOrder()).toEqual(['a', 'b'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'move step 1 down' }))
  })

  it('moves focus to the next card\'s handle when a focused card is deleted', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b'), step('c')])
    screen.getByRole('button', { name: 'delete step 2' }).focus()
    await user.keyboard('{Enter}')
    expect(stepOrder()).toEqual(['a', 'c'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /reorder step 2/i }))
    // deleting the last card lands on the new last card
    screen.getByRole('button', { name: 'delete step 2' }).focus()
    await user.keyboard('{Enter}')
    expect(stepOrder()).toEqual(['a'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /reorder step 1/i }))
  })

  it('keeps keyboard focus in the list when a macro is unwrapped', async () => {
    const user = userEvent.setup()
    const macro = { id: 'm', type: 'macro', enabled: true, name: 'mac', steps: [step('x'), step('y')] }
    renderTool([step('a'), macro])
    screen.getByRole('button', { name: 'unwrap' }).focus()
    await user.keyboard('{Enter}')
    expect(stepOrder()).toEqual(['a', 'x', 'y'])
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /reorder step 2/i }))
  })

  it('Alt+ArrowUp does nothing on the first step', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b')])
    const handle = screen.getByRole('button', { name: /reorder step 1/i })
    handle.focus()
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}')
    expect(stepOrder()).toEqual(['a', 'b'])
  })

  it('dispatches REORDER once on drag end, not on every live-reorder frame', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b'), step('c')])
    expect(screen.getByTestId('can-undo').textContent).toBe('false')

    // live drag frames update the visual order only
    await user.click(screen.getByTestId('simulate-live-reorder'))
    expect(stepOrder()).toEqual(['c', 'b', 'a'])
    expect(screen.getByTestId('can-undo').textContent).toBe('false')

    expect(storeTree()).toEqual(['a', 'b', 'c'])

    // ending the drag commits it to the store exactly once
    await user.click(screen.getByTestId('simulate-drag-end-c'))
    expect(screen.getByTestId('can-undo').textContent).toBe('true')
    expect(stepOrder()).toEqual(['c', 'b', 'a'])
    expect(storeTree()).toEqual(['c', 'b', 'a'])
  })

  it('commits a drag inside a branch lane to that lane only (REORDER with parentId + lane)', async () => {
    const user = userEvent.setup()
    const branch = { id: 'br', type: 'branch', enabled: true, branches: [[step('x'), step('y')], [step('z'), step('w')]], merge: { mode: 'concat', separator: '\n' } }
    renderTool([step('a'), branch])
    // groups in document order: the top level, then lane 1, then lane 2
    const groups = screen.getAllByTestId('simulate-live-reorder')
    expect(groups).toHaveLength(3)
    await user.click(groups[2])
    await user.click(screen.getByTestId('simulate-drag-end-w'))
    expect(storeTree()).toEqual(['a', { br: [['x', 'y'], ['w', 'z']] }])
  })
})

describe('<StepList /> animation', () => {
  it('animates reorders by position only, so a card whose preview grows is not scale-distorted', () => {
    renderTool([step('a'), step('b')])
    expect(screen.getByTestId('reorder-item-a')).toHaveAttribute('data-layout', 'position')
  })
})

describe('<StepList /> selection mode', () => {
  const selectFirstTwo = async user => {
    await user.click(screen.getByRole('button', { name: 'select' }))
    await user.click(screen.getByLabelText('select step 1'))
    await user.click(screen.getByLabelText('select step 2'))
  }

  it('groups a contiguous selection into a macro, named inline (no blocking window.prompt)', async () => {
    const user = userEvent.setup()
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue('from-prompt')
    renderTool([step('a'), step('b'), step('c')])
    await selectFirstTwo(user)

    expect(screen.queryByText(/must be contiguous/)).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Group into macro…' }))
    const name = screen.getByLabelText('name for the new macro')
    expect(name).toHaveFocus()
    await user.clear(name)
    await user.type(name, 'combo{Enter}')

    expect(prompt).not.toHaveBeenCalled()
    expect(await screen.findByLabelText('macro name')).toHaveValue('combo')
    // the macro (steps a+b) collapses to one row, leaving c as the only other step
    expect(screen.getAllByText(/^step \d+$/)).toHaveLength(2)
    expect(screen.getByText('step 2').closest('[data-step-id]')).toHaveAttribute('data-step-id', 'c')
  })

  it('Escape cancels naming without grouping and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b')])
    await selectFirstTwo(user)
    const trigger = screen.getByRole('button', { name: 'Group into macro…' })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByLabelText('name for the new macro')).toBeNull()
    expect(trigger).toHaveFocus()
    expect(stepOrder()).toEqual(['a', 'b'])
    expect(screen.getByTestId('can-undo').textContent).toBe('false')
  })

  it('explains why a non-contiguous selection cannot be grouped', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b'), step('c')])

    await user.click(screen.getByRole('button', { name: 'select' }))
    await user.click(screen.getByLabelText('select step 1'))
    await user.click(screen.getByLabelText('select step 3'))

    expect(screen.getByText(/must be contiguous/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Group into macro…' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Put in a branch' })).toBeDisabled()
    // saving a copy and deleting don't require contiguity
    expect(screen.getByRole('button', { name: 'Save as macro…' })).not.toBeDisabled()
    expect(screen.getByRole('button', { name: 'Delete selected' })).not.toBeDisabled()
  })

  it('saves a deep copy of a (non-contiguous) selection to the library and announces it', async () => {
    const user = userEvent.setup()
    renderTool([step('a', 'trim'), step('b'), step('c', 'reverse')])
    await user.click(screen.getByRole('button', { name: 'select' }))
    await user.click(screen.getByLabelText('select step 1'))
    await user.click(screen.getByLabelText('select step 3'))
    await user.click(screen.getByRole('button', { name: 'Save as macro…' }))
    await user.clear(screen.getByLabelText('name for the new macro'))
    await user.type(screen.getByLabelText('name for the new macro'), 'kept{Enter}')

    const live = await screen.findByText('saved "kept" to library')
    expect(live.closest('[aria-live]')).not.toBeNull()
    const [entry, ...rest] = listEntries('macro')
    expect(rest).toHaveLength(0)
    expect(entry.name).toBe('kept')
    expect(entry.steps.map(s => s.utilityId)).toEqual(['trim', 'reverse'])
    expect(entry.steps.some(s => ['a', 'b', 'c'].includes(s.id))).toBe(false)
    // the pipeline itself is untouched
    expect(stepOrder()).toEqual(['a', 'b', 'c'])
    expect(screen.getByTestId('can-undo').textContent).toBe('false')
  })

  it('deletes the selected steps', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b'), step('c')])
    await selectFirstTwo(user)
    await user.click(screen.getByRole('button', { name: 'Delete selected' }))
    expect(stepOrder()).toEqual(['c'])
    expect(screen.getByText('deleted 2 steps').closest('[aria-live]')).not.toBeNull()
    // the pressed button is now disabled (nothing selected): focus stays in the bar
    expect(screen.getByRole('button', { name: 'Delete selected' })).toBeDisabled()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'done selecting' }))
  })

  it('wraps a contiguous selection into a branch', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b')])
    await selectFirstTwo(user)
    await user.click(screen.getByRole('button', { name: 'Put in a branch' }))
    expect(await screen.findByText('branch')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'done selecting' }))
    expect(document.querySelector('[data-step-id="a"]').closest('[data-step-id^="branch"]')).not.toBeNull()
  })

  it('offers no selection mode for an empty sequence', () => {
    renderTool([])
    expect(screen.queryByRole('button', { name: 'select' })).toBeNull()
  })

  it('gives each nested sequence its own, distinctly named selection toggle', () => {
    const branch = { id: 'br', type: 'branch', enabled: true, branches: [[step('x')], [step('y')]], merge: { mode: 'concat', separator: '\n' } }
    renderTool([branch])
    expect(screen.getByRole('button', { name: 'select' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'select steps in lane 1' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'select steps in lane 2' })).toBeTruthy()
  })
})

describe('<BulkToggle /> through the real store', () => {
  it('disables and re-enables every step, nested ones included', async () => {
    const user = userEvent.setup()
    const macro = { id: 'm', type: 'macro', enabled: true, name: 'mac', steps: [step('x')] }
    renderTool([step('a'), macro], <BulkToggle />)
    expect(JSON.parse(screen.getByTestId('enabled').textContent)).toEqual([true, true, true])
    await user.click(screen.getByRole('button', { name: 'Disable all' }))
    expect(JSON.parse(screen.getByTestId('enabled').textContent)).toEqual([false, false, false])
    expect(screen.getByLabelText('toggle step 1')).not.toBeChecked()
    await user.click(screen.getByRole('button', { name: 'Enable all' }))
    expect(JSON.parse(screen.getByTestId('enabled').textContent)).toEqual([true, true, true])
  })

  it('renders inert (disabled) outside a ToolProvider', () => {
    render(<BulkToggle />)
    expect(screen.getByRole('button', { name: 'Enable all' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Disable all' })).toBeDisabled()
  })
})

describe('<StepList /> menu actions through the real store', () => {
  it('Solo disables every sibling; Rename labels the step', async () => {
    const user = userEvent.setup()
    renderTool([step('a'), step('b'), step('c')])
    await user.click(screen.getByRole('button', { name: 'step 2 menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Solo' }))
    expect(screen.getByLabelText('toggle step 1')).not.toBeChecked()
    expect(screen.getByLabelText('toggle step 2')).toBeChecked()
    expect(screen.getByLabelText('toggle step 3')).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'step 3 menu' }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    await user.type(screen.getByLabelText('step name'), 'tidy up{Enter}')
    expect(screen.getByText('tidy up').closest('[data-step-id]')).toHaveAttribute('data-step-id', 'c')
  })
})
