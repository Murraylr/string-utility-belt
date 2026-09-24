/**
 * The whole keyboard chain as the app mounts it: useShortcuts + CommandPalette +
 * ShortcutsHelp at app level, ToolCommandBridge inside a real ToolProvider.
 */
import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider, useTool } from '@/app/ToolContext'
import CommandPalette from './CommandPalette'
import ShortcutsHelp from './ShortcutsHelp'
import ToolCommandBridge from './ToolCommandBridge'
import { useShortcuts } from './useShortcuts'

const FAKE_META = vi.hoisted(() => ({
  id: 'trim', name: 'trim', category: 'String Ops', description: 'trim whitespace', accepts: 'string', produces: 'string',
  params: { side: { kind: 'select', label: 'side', options: ['both', 'start', 'end'], default: 'both' } },
  tags: ['whitespace'], aliases: ['strip'], env: [], streamable: false, exampleCount: 0,
}))

vi.mock('@/app/registry', () => ({
  registry: {
    list: () => [FAKE_META],
    get: (id: string) => (id === 'trim' ? FAKE_META : undefined),
    has: (id: string) => id === 'trim',
    categories: () => ['String Ops'],
    byCategory: () => [FAKE_META],
    load: async () => ({ ...FAKE_META, apply: (input: unknown) => String(input).trim() }),
  },
}))

function Probe() {
  const { state } = useTool()
  return (
    <div>
      <div data-testid="count">{state.steps.length}</div>
      <div data-testid="steps">{JSON.stringify(state.steps.map(s => ('utilityId' in s ? [s.utilityId, s.params, s.enabled] : null)))}</div>
    </div>
  )
}

function App() {
  useShortcuts()
  return (
    <>
      <button>page button</button>
      <ToolProvider persist={false}>
        <textarea aria-label="input" />
        <Probe />
        <ToolCommandBridge />
      </ToolProvider>
      <CommandPalette />
      <ShortcutsHelp />
    </>
  )
}

beforeEach(() => {
  localStorage.clear()
  location.hash = ''
})

describe('palette + shortcuts + bridge', { timeout: 20_000 }, () => {
  it('Ctrl+K, type, Enter adds the utility with its default params, then Ctrl+Z / Ctrl+Shift+Z undo and redo it', async () => {
    const user = userEvent.setup({ delay: null })
    render(<App />)
    const pageButton = screen.getByText('page button')
    pageButton.focus()

    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument()
    await user.keyboard('strip')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(screen.getByTestId('steps').textContent).toBe(JSON.stringify([['trim', { side: 'both' }, true]]))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(pageButton)

    await user.keyboard('{Control>}z{/Control}')
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
  })

  it('Ctrl+Z inside the input textarea is left to the browser (native text undo)', async () => {
    const user = userEvent.setup({ delay: null })
    render(<App />)
    await user.keyboard('/')
    await user.keyboard('trim{Enter}')
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    await user.click(screen.getByLabelText('input'))
    await user.keyboard('{Control>}z{/Control}')
    expect(screen.getByTestId('count').textContent).toBe('1')
  })

  it('"?" opens the help; palette shortcuts stay inert until it is closed', async () => {
    const user = userEvent.setup({ delay: null })
    render(<App />)
    screen.getByText('page button').focus()
    await user.keyboard('?')
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeInTheDocument()
    await user.keyboard('/')
    await user.keyboard('{Control>}k{/Control}')
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByText('page button'))
  })

  it('palette commands act on the pipeline: disable all steps', async () => {
    const user = userEvent.setup({ delay: null })
    render(<App />)
    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('trim{Enter}')
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    await user.keyboard('{Control>}k{/Control}')
    await user.keyboard('disable all')
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' })
    await waitFor(() => expect(screen.getByTestId('steps').textContent).toBe(JSON.stringify([['trim', { side: 'both' }, false]])))
  })
})
