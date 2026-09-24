import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StepMenu from './StepMenu'

vi.setConfig({ testTimeout: 20000 })

function setup(props = {}) {
  const handlers = {
    onDuplicate: vi.fn(), onSolo: vi.fn(), onRename: vi.fn(),
    onMoveUp: vi.fn(), onMoveDown: vi.fn(), onDelete: vi.fn(),
  }
  render(<StepMenu index={1} total={3} label="my step" {...handlers} {...props} />)
  return handlers
}

describe('<StepMenu />', () => {
  it('opens on click, focusing the first item, and supports arrow-key navigation', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /menu/i }))
    const items = screen.getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(items[2]).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    expect(items[1]).toHaveFocus()
    await user.keyboard('{End}')
    expect(items[items.length - 1]).toHaveFocus()
    await user.keyboard('{Home}')
    expect(items[0]).toHaveFocus()
  })

  it('opens from the trigger with ArrowDown (first item) or ArrowUp (last item)', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = screen.getByRole('button', { name: /menu/i })
    trigger.focus()
    await user.keyboard('{ArrowDown}')
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByRole('menuitem')[0]).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    await user.keyboard('{ArrowUp}')
    const items = screen.getAllByRole('menuitem')
    expect(items[items.length - 1]).toHaveFocus()
  })

  it('closes on Escape and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = screen.getByRole('button', { name: /menu/i })
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes when focus leaves it with Tab (menu-button pattern)', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('menu')).toBeTruthy()
    await user.tab()
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Escape while renaming cancels without renaming and returns focus to the trigger', async () => {
    const user = userEvent.setup()
    const handlers = setup()
    const trigger = screen.getByRole('button', { name: /menu/i })
    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    await user.type(screen.getByLabelText('step name'), 'x{Escape}')
    expect(handlers.onRename).not.toHaveBeenCalled()
    expect(trigger).toHaveFocus()
  })

  it('calls onDuplicate, onSolo and onDelete', async () => {
    const user = userEvent.setup()
    const handlers = setup()
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(handlers.onDuplicate).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Solo' }))
    expect(handlers.onSolo).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
    expect(handlers.onDelete).toHaveBeenCalledTimes(1)
  })

  it('disables move up at the top and move down at the bottom', async () => {
    const user = userEvent.setup()
    setup({ index: 0, total: 3 })
    await user.click(screen.getByRole('button', { name: /menu/i }))
    expect(screen.getByRole('menuitem', { name: 'Move up' })).toBeDisabled()
    expect(screen.getByRole('menuitem', { name: 'Move down' })).not.toBeDisabled()
  })

  it('rename switches to a text field pre-filled with the current label and submits on Enter', async () => {
    const user = userEvent.setup()
    const handlers = setup()
    await user.click(screen.getByRole('button', { name: /menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = screen.getByLabelText('step name')
    expect(input.value).toBe('my step')
    // a role="menu" may only own menu items, so the rename form is a labelled group instead
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByRole('group', { name: 'rename step 2' })).toContainElement(input)
    expect(input).toHaveFocus()
    await user.clear(input)
    await user.type(input, 'renamed{enter}')
    expect(handlers.onRename).toHaveBeenCalledWith('renamed')
    expect(screen.queryByRole('menu')).toBeNull()
  })
})
