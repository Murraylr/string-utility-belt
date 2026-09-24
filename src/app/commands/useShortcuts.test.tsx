import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useShortcuts } from './useShortcuts'
import { TOOL_COMMAND_EVENT, EVENT_OPEN_PALETTE, EVENT_OPEN_SHORTCUTS, type ToolCommandDetail } from './commands'

function Harness() {
  useShortcuts()
  return (
    <div>
      <input aria-label="pipeline input" />
      <textarea aria-label="pipeline textarea" />
    </div>
  )
}

function listen(name: string) {
  const handler = vi.fn()
  window.addEventListener(name, handler)
  return { handler, stop: () => window.removeEventListener(name, handler) }
}

describe('useShortcuts', () => {
  it('opens the palette on Ctrl+K', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const { handler, stop } = listen(EVENT_OPEN_PALETTE)
    await user.keyboard('{Control>}k{/Control}')
    expect(handler).toHaveBeenCalledTimes(1)
    stop()
  })

  it('opens the palette on Ctrl+K even while focus is in a text field', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const { handler, stop } = listen(EVENT_OPEN_PALETTE)
    await user.click(screen.getByLabelText('pipeline input'))
    await user.keyboard('{Control>}k{/Control}')
    expect(handler).toHaveBeenCalledTimes(1)
    stop()
  })

  it('dispatches undo/redo on Ctrl+Z / Ctrl+Shift+Z outside text fields', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const events: ToolCommandDetail['command'][] = []
    const onCmd = (e: Event) => events.push((e as CustomEvent<ToolCommandDetail>).detail.command)
    window.addEventListener(TOOL_COMMAND_EVENT, onCmd)
    document.body.focus()
    await user.keyboard('{Control>}z{/Control}')
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(events).toEqual(['undo', 'redo'])
    window.removeEventListener(TOOL_COMMAND_EVENT, onCmd)
  })

  it('ignores Ctrl+Z / Ctrl+Shift+Z while focus is in a text field (native undo)', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const events: string[] = []
    const onCmd = (e: Event) => events.push((e as CustomEvent<ToolCommandDetail>).detail.command)
    window.addEventListener(TOOL_COMMAND_EVENT, onCmd)
    await user.click(screen.getByLabelText('pipeline textarea'))
    await user.keyboard('{Control>}z{/Control}')
    expect(events).toEqual([])
    window.removeEventListener(TOOL_COMMAND_EVENT, onCmd)
  })

  it('runs now on Ctrl+Enter even inside a textarea', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const events: string[] = []
    const onCmd = (e: Event) => events.push((e as CustomEvent<ToolCommandDetail>).detail.command)
    window.addEventListener(TOOL_COMMAND_EVENT, onCmd)
    await user.click(screen.getByLabelText('pipeline textarea'))
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(events).toEqual(['runNow'])
    window.removeEventListener(TOOL_COMMAND_EVENT, onCmd)
  })

  it('opens shortcuts help on "?" and the palette on "/" outside text fields', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const help = listen(EVENT_OPEN_SHORTCUTS)
    const palette = listen(EVENT_OPEN_PALETTE)
    document.body.focus()
    await user.keyboard('?')
    await user.keyboard('/')
    expect(help.handler).toHaveBeenCalledTimes(1)
    expect(palette.handler).toHaveBeenCalledTimes(1)
    help.stop(); palette.stop()
  })

  it('leaves a key alone when an inner handler already handled it (preventDefault)', () => {
    render(
      <div>
        <Harness />
        <button onKeyDown={e => e.preventDefault()}>handles its own keys</button>
      </div>
    )
    const palette = listen(EVENT_OPEN_PALETTE)
    const events: string[] = []
    const onCmd = (e: Event) => events.push((e as CustomEvent<ToolCommandDetail>).detail.command)
    window.addEventListener(TOOL_COMMAND_EVENT, onCmd)
    const btn = screen.getByText('handles its own keys')
    fireEvent.keyDown(btn, { key: 'Enter', ctrlKey: true })
    fireEvent.keyDown(btn, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(btn, { key: 'z', ctrlKey: true })
    expect(events).toEqual([])
    expect(palette.handler).not.toHaveBeenCalled()
    window.removeEventListener(TOOL_COMMAND_EVENT, onCmd)
    palette.stop()
  })

  it('stays out of the way while another modal dialog is open', () => {
    render(
      <div>
        <Harness />
        <div role="dialog" aria-modal="true" aria-label="share"><button>copy link</button></div>
      </div>
    )
    const palette = listen(EVENT_OPEN_PALETTE)
    const help = listen(EVENT_OPEN_SHORTCUTS)
    const events: string[] = []
    const onCmd = (e: Event) => events.push((e as CustomEvent<ToolCommandDetail>).detail.command)
    window.addEventListener(TOOL_COMMAND_EVENT, onCmd)
    const btn = screen.getByText('copy link')
    fireEvent.keyDown(btn, { key: 'z', ctrlKey: true })
    fireEvent.keyDown(btn, { key: '/' })
    fireEvent.keyDown(btn, { key: '?' })
    fireEvent.keyDown(btn, { key: 'k', ctrlKey: true })
    expect(events).toEqual([])
    expect(palette.handler).not.toHaveBeenCalled()
    expect(help.handler).not.toHaveBeenCalled()
    window.removeEventListener(TOOL_COMMAND_EVENT, onCmd)
    palette.stop(); help.stop()
  })

  it('is not blocked by a modal dialog that is kept in the DOM but hidden', () => {
    render(
      <div>
        <Harness />
        <div hidden><div role="dialog" aria-modal="true" aria-label="closed share dialog" /></div>
      </div>
    )
    const palette = listen(EVENT_OPEN_PALETTE)
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })
    expect(palette.handler).toHaveBeenCalledTimes(1)
    palette.stop()
  })

  it('still toggles the palette with Ctrl+K while the palette itself is the open dialog', () => {
    render(
      <div>
        <Harness />
        <div role="dialog" aria-modal="true" data-command-palette=""><input aria-label="palette search" /></div>
      </div>
    )
    const palette = listen(EVENT_OPEN_PALETTE)
    fireEvent.keyDown(screen.getByLabelText('palette search'), { key: 'k', ctrlKey: true })
    expect(palette.handler).toHaveBeenCalledTimes(1)
    palette.stop()
  })

  it('handles each key once even when mounted by several components, until the last unmounts', () => {
    const first = render(<Harness />)
    const second = render(<Harness />)
    const palette = listen(EVENT_OPEN_PALETTE)
    const events: string[] = []
    const onCmd = (e: Event) => events.push((e as CustomEvent<ToolCommandDetail>).detail.command)
    window.addEventListener(TOOL_COMMAND_EVENT, onCmd)
    // a second listener would toggle the palette shut again and undo twice
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(palette.handler).toHaveBeenCalledTimes(1)
    expect(events).toEqual(['undo'])
    first.unmount()
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(events).toEqual(['undo', 'undo'])
    second.unmount()
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(events).toEqual(['undo', 'undo'])
    window.removeEventListener(TOOL_COMMAND_EVENT, onCmd)
    palette.stop()
  })

  it('ignores auto-repeat of the Ctrl+K toggle, so holding it does not flicker the palette', () => {
    render(<Harness />)
    const palette = listen(EVENT_OPEN_PALETTE)
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, repeat: true })
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true, repeat: true })
    expect(palette.handler).toHaveBeenCalledTimes(1)
    palette.stop()
  })

  it('matches by physical key on non-Latin layouts (Ctrl+K on a Cyrillic layout)', () => {
    render(<Harness />)
    const palette = listen(EVENT_OPEN_PALETTE)
    fireEvent.keyDown(document.body, { key: 'л', code: 'KeyK', ctrlKey: true })
    expect(palette.handler).toHaveBeenCalledTimes(1)
    palette.stop()
  })

  it('treats non-text inputs (a step toggle checkbox, a slider) as not typing: Ctrl+Z still undoes', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <Harness />
        <input type="checkbox" aria-label="toggle step 1" />
        <input type="range" aria-label="level" />
      </div>
    )
    const events: string[] = []
    const onCmd = (e: Event) => events.push((e as CustomEvent<ToolCommandDetail>).detail.command)
    window.addEventListener(TOOL_COMMAND_EVENT, onCmd)
    // toggling a step leaves focus on its checkbox, which has no native text undo
    await user.click(screen.getByLabelText('toggle step 1'))
    await user.keyboard('{Control>}z{/Control}')
    fireEvent.keyDown(screen.getByLabelText('level'), { key: 'y', ctrlKey: true })
    expect(events).toEqual(['undo', 'redo'])
    // text-entry inputs of any type still keep native undo
    render(<input type="search" aria-label="find" />)
    fireEvent.keyDown(screen.getByLabelText('find'), { key: 'z', ctrlKey: true })
    expect(events).toEqual(['undo', 'redo'])
    window.removeEventListener(TOOL_COMMAND_EVENT, onCmd)
  })

  it('does not open on "?" or "/" while typing in a text field', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const help = listen(EVENT_OPEN_SHORTCUTS)
    const input = screen.getByLabelText('pipeline input') as HTMLInputElement
    await user.click(input)
    await user.keyboard('?')
    expect(help.handler).not.toHaveBeenCalled()
    expect(input.value).toBe('?')
    help.stop()
  })
})
