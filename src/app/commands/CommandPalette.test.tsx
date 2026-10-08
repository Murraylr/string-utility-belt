import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import CommandPalette from './CommandPalette'
import ShortcutsHelp from './ShortcutsHelp'
import { attachToolBridge, EVENT_OPEN_PALETTE, TOOL_COMMAND_EVENT, type ToolCommandDetail } from './commands'

const lastOf = <T,>(list: T[]): T => list[list.length - 1]

const FAKE_METAS = vi.hoisted(() => [
  { id: 'base64_encode', name: 'base64 encode', category: 'Encoding', description: 'encode as base64', accepts: 'string', produces: 'string', params: {}, tags: [], aliases: [], env: [], streamable: false, exampleCount: 0 },
  { id: 'trim', name: 'trim', category: 'String Ops', description: 'trim whitespace', accepts: 'string', produces: 'string', params: {}, tags: [], aliases: [], env: [], streamable: false, exampleCount: 0 },
])

vi.mock('@/app/registry', () => {
  const byId = new Map(FAKE_METAS.map(m => [m.id, m]))
  return {
    registry: {
      list: () => FAKE_METAS,
      get: (id: string) => byId.get(id),
      has: (id: string) => byId.has(id),
      categories: () => [...new Set(FAKE_METAS.map(m => m.category))],
      byCategory: () => FAKE_METAS,
      load: vi.fn(),
    },
  }
})

/** Stand-in for a mounted pipeline editor (what ToolCommandBridge registers). */
let detachEditor: (() => void) | null = null
const mountEditor = () => { detachEditor = attachToolBridge() }

let toolEvents: ToolCommandDetail[] = []
const onToolEvent = (e: Event) => toolEvents.push((e as CustomEvent<ToolCommandDetail>).detail)

beforeEach(() => {
  localStorage.clear()
  location.hash = ''
  toolEvents = []
  window.addEventListener(TOOL_COMMAND_EVENT, onToolEvent)
})

afterEach(() => {
  window.removeEventListener(TOOL_COMMAND_EVENT, onToolEvent)
  detachEditor?.()
  detachEditor = null
  attachToolBridge()() // drop anything a test left queued
})

const open = (detail?: unknown) => act(() => { window.dispatchEvent(new CustomEvent(EVENT_OPEN_PALETTE, { detail })) })
const combobox = () => screen.getByRole('combobox')
const type = (value: string) => fireEvent.change(combobox(), { target: { value } })

describe('CommandPalette', () => {
  it('is closed until the open-palette event fires, and toggles on a second one', () => {
    render(<CommandPalette />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    open()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    open()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens on Ctrl+K and "/" by itself (no separate useShortcuts mount needed)', () => {
    render(<CommandPalette />)
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true })
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
    fireEvent.keyDown(combobox(), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    fireEvent.keyDown(document.body, { key: '/' })
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
  })

  it('searches commands and utilities together', () => {
    mountEditor()
    render(<CommandPalette />)
    open()
    type('undo')
    expect(screen.getByText('Undo')).toBeInTheDocument()

    type('base64')
    // the name is split across a <mark> for the matched chars, so check the option's text content
    const option = screen.getByRole('option')
    expect(option).toHaveTextContent('base64 encode')
    expect(option.querySelector('mark')).not.toBeNull()
    expect(screen.getByRole('status')).toHaveTextContent('1 result')
  })

  it('running a command dispatches its tool-command event and closes the palette', () => {
    mountEditor()
    render(<CommandPalette />)
    open()
    type('clear pipeline')
    fireEvent.keyDown(combobox(), { key: 'Enter' })
    expect(toolEvents).toEqual([{ command: 'clear' }])
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('hides pipeline commands when no pipeline editor is on screen', () => {
    render(<CommandPalette />)
    open()
    expect(screen.queryByText('Undo')).not.toBeInTheDocument()
    expect(screen.queryByText('Clear pipeline')).not.toBeInTheDocument()
    expect(screen.getByText('Go to Blog')).toBeInTheDocument()
    expect(screen.getByText('Add utility…')).toBeInTheDocument()
  })

  it('"Add utility…" switches to utility-only mode without closing', () => {
    render(<CommandPalette />)
    open()
    type('Add utility')
    fireEvent.click(screen.getByText('Add utility…'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Add a utility' })).toBeInTheDocument()
    expect(combobox()).toHaveValue('')
    expect(screen.getByText('trim')).toBeInTheDocument()
    expect(screen.getByText('base64 encode')).toBeInTheDocument()
    expect(screen.queryByText('Go to Blog')).not.toBeInTheDocument()
  })

  it('can be opened straight into utility mode via the event detail', () => {
    render(<CommandPalette />)
    open({ mode: 'utility' })
    expect(screen.getByRole('heading', { name: 'Add a utility' })).toBeInTheDocument()
  })

  it('adds a picked utility to the editor on screen — without navigating away (e.g. a shared-pipeline route)', () => {
    location.hash = '#/p/some-shared-payload'
    mountEditor()
    render(<CommandPalette />)
    open()
    type('trim')
    fireEvent.click(screen.getByText('trim'))
    expect(toolEvents).toEqual([{ command: 'addStep', utilityId: 'trim' }])
    expect(location.hash).toBe('#/p/some-shared-payload')
    expect(JSON.parse(localStorage.getItem('sub:pref:recents') || '[]')).toEqual(['trim'])
  })

  it('with no editor mounted, navigates to the tool and adds the step once the editor mounts', async () => {
    location.hash = '#/blog'
    render(<CommandPalette />)
    open()
    type('trim')
    fireEvent.click(screen.getByText('trim'))
    expect(location.hash).toBe('#/')
    // the tool route can render arbitrarily later (lazy chunks, scheduler): nothing is lost meanwhile
    await act(async () => { await new Promise(r => setTimeout(r, 30)) })
    expect(toolEvents).toEqual([])
    mountEditor()
    await act(async () => { await Promise.resolve() })
    expect(toolEvents).toEqual([{ command: 'addStep', utilityId: 'trim' }])
  })

  it('"Library" from another route goes to the tool and opens the library there', async () => {
    location.hash = '#/blog'
    const opened = vi.fn()
    window.addEventListener('sub:open-library', opened)
    render(<CommandPalette />)
    open()
    type('library')
    fireEvent.keyDown(combobox(), { key: 'Enter' })
    expect(location.hash).toBe('#/')
    expect(opened).not.toHaveBeenCalled()
    mountEditor()
    await act(async () => { await Promise.resolve() })
    expect(opened).toHaveBeenCalledTimes(1)
    window.removeEventListener('sub:open-library', opened)
  })

  it('lists recently run commands first, in their own list (not the utility recents)', () => {
    mountEditor()
    render(<CommandPalette />)
    open()
    type('go to blog')
    fireEvent.keyDown(combobox(), { key: 'Enter' })
    expect(JSON.parse(localStorage.getItem('sub:pref:recentCommands') || '[]')).toEqual(['goto-blog'])
    expect(localStorage.getItem('sub:pref:recents')).toBeNull()
    open()
    expect(screen.getAllByRole('option')[0]).toHaveTextContent('Go to Blog')
  })

  it('navigates the list with arrow keys and Home/End, scrolling the active option into view', () => {
    const scroll = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scroll
    try {
      render(<CommandPalette />)
      open()
      const options = () => screen.getAllByRole('option')
      fireEvent.keyDown(combobox(), { key: 'ArrowDown' })
      fireEvent.keyDown(combobox(), { key: 'ArrowDown' })
      expect(options()[2]).toHaveAttribute('aria-selected', 'true')
      expect(combobox()).toHaveAttribute('aria-activedescendant', options()[2].id)
      expect(scroll).toHaveBeenCalled()
      expect(lastOf(scroll.mock.contexts)).toBe(options()[2])
      fireEvent.keyDown(combobox(), { key: 'End' })
      expect(lastOf(options())).toHaveAttribute('aria-selected', 'true')
      fireEvent.keyDown(combobox(), { key: 'Home' })
      expect(options()[0]).toHaveAttribute('aria-selected', 'true')
    } finally {
      Element.prototype.scrollIntoView = original
    }
  })

  it('does not pick on Ctrl+Enter (run-now shortcut) or while an IME composition is confirmed', () => {
    render(<CommandPalette />)
    open()
    type('go to blog')
    fireEvent.keyDown(combobox(), { key: 'Enter', ctrlKey: true })
    fireEvent.keyDown(combobox(), { key: 'Enter', isComposing: true })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(location.hash).toBe('')
  })

  it('Escape closes the palette and returns focus to the opener', () => {
    render(<><button>opener</button><CommandPalette /></>)
    const opener = screen.getByText('opener')
    opener.focus()
    open()
    expect(document.activeElement).toBe(combobox())
    fireEvent.keyDown(combobox(), { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })

  it('Escape still closes when focus is on the dialog itself (after a click on its body)', () => {
    render(<CommandPalette />)
    open()
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('tabindex', '-1')
    dialog.focus()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps Tab inside the dialog', () => {
    render(<><button>outside</button><CommandPalette /></>)
    open()
    // the search box comes first, the Esc (close) button last
    const close = screen.getByLabelText('close')
    close.focus()
    fireEvent.keyDown(close, { key: 'Tab' })
    expect(document.activeElement).toBe(combobox())
    fireEvent.keyDown(combobox(), { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(close)
    screen.getByRole('dialog').focus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' })
    expect(document.activeElement).toBe(combobox())
  })

  it('"Keyboard shortcuts" closes the palette first, so the help dialog keeps focus and returns it to the real opener', () => {
    // help mounted BEFORE the palette: its effects run first, which used to let the
    // palette's focus-restore steal focus back out of the freshly opened help dialog
    render(<><button>opener</button><ShortcutsHelp /><CommandPalette /></>)
    const opener = screen.getByText('opener')
    opener.focus()
    open()
    type('keyboard shortcuts')
    fireEvent.keyDown(combobox(), { key: 'Enter' })
    const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' })
    expect(help.contains(document.activeElement)).toBe(true)
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(opener)
  })

  it('closes on a backdrop click, but not when a press inside the dialog is released on the backdrop', () => {
    render(<CommandPalette />)
    open()
    const backdrop = screen.getByRole('dialog').parentElement!
    // e.g. selecting text in the search box and letting go outside the card
    fireEvent.mouseDown(combobox())
    fireEvent.click(backdrop)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.mouseDown(backdrop)
    fireEvent.click(backdrop)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('marks its dialog so global shortcuts know it is the palette', () => {
    render(<CommandPalette />)
    open()
    expect(screen.getByRole('dialog')).toHaveAttribute('data-command-palette')
  })
})
