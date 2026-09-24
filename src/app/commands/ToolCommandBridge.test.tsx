import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { ToolProvider, useTool } from '@/app/ToolContext'
import ToolCommandBridge from './ToolCommandBridge'
import { dispatchToolCommand, hasToolBridge, queueToolCommand, runInTool } from './commands'

const FAKE_META = { id: 'trim', name: 'trim', category: 'String Ops', description: 'trim', accepts: 'string', produces: 'string', params: {}, tags: [], aliases: [], env: [], streamable: false, exampleCount: 0 }
const FAKE_UTIL = { ...FAKE_META, apply: (input: unknown) => String(input).trim() }

vi.mock('@/app/registry', () => ({
  registry: {
    list: () => [FAKE_META],
    get: (id: string) => (id === 'trim' ? FAKE_META : undefined),
    has: (id: string) => id === 'trim',
    categories: () => ['String Ops'],
    byCategory: () => [FAKE_META],
    load: async (id: string) => (id === 'trim' ? FAKE_UTIL : Promise.reject(new Error('unknown'))),
  },
}))

function Probe() {
  const { state, showPreviews, liveRun } = useTool()
  return (
    <div>
      <div data-testid="count">{state.steps.length}</div>
      <div data-testid="enabled">{state.steps.map(s => String(s.enabled)).join(',')}</div>
      <div data-testid="previews">{String(showPreviews)}</div>
      <div data-testid="live">{String(liveRun)}</div>
    </div>
  )
}

beforeEach(() => localStorage.clear())

describe('ToolCommandBridge', () => {
  it('executes addStep, undo, redo and clear against a real ToolProvider', async () => {
    render(<ToolProvider persist={false}><Probe /><ToolCommandBridge /></ToolProvider>)
    expect(screen.getByTestId('count').textContent).toBe('0')

    act(() => dispatchToolCommand({ command: 'addStep', utilityId: 'trim' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))

    act(() => dispatchToolCommand({ command: 'addStep', utilityId: 'trim' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))

    act(() => dispatchToolCommand({ command: 'undo' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))

    act(() => dispatchToolCommand({ command: 'redo' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'))

    act(() => dispatchToolCommand({ command: 'clear' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'))
  })

  it('records a recently-used pick when adding a step', async () => {
    render(<ToolProvider persist={false}><Probe /><ToolCommandBridge /></ToolProvider>)
    act(() => dispatchToolCommand({ command: 'addStep', utilityId: 'trim' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(JSON.parse(localStorage.getItem('sub:pref:recents') || '[]')).toEqual(['trim'])
  })

  it('enables and disables all steps', async () => {
    render(<ToolProvider persist={false}><Probe /><ToolCommandBridge /></ToolProvider>)
    act(() => dispatchToolCommand({ command: 'addStep', utilityId: 'trim' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))

    act(() => dispatchToolCommand({ command: 'disableAll' }))
    await waitFor(() => expect(screen.getByTestId('enabled').textContent).toBe('false'))

    act(() => dispatchToolCommand({ command: 'enableAll' }))
    await waitFor(() => expect(screen.getByTestId('enabled').textContent).toBe('true'))
  })

  it('applies a command queued before any editor was mounted once the bridge mounts', async () => {
    expect(hasToolBridge()).toBe(false)
    queueToolCommand({ command: 'addStep', utilityId: 'trim' })
    render(<ToolProvider persist={false}><Probe /><ToolCommandBridge /></ToolProvider>)
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(hasToolBridge()).toBe(true)
  })

  it('delivers a held action to a toolbar dialog that starts listening after the bridge in the same commit', async () => {
    const opened = vi.fn()
    function ShareButtonLike() {
      React.useEffect(() => {
        window.addEventListener('sub:open-share', opened)
        return () => window.removeEventListener('sub:open-share', opened)
      }, [])
      return null
    }
    location.hash = '#/blog'
    runInTool(() => window.dispatchEvent(new CustomEvent('sub:open-share')))
    expect(location.hash).toBe('#/')
    // bridge first, dialog second: the dialog's effect runs after the bridge's flush point
    render(<ToolProvider persist={false}><ToolCommandBridge /><ShareButtonLike /></ToolProvider>)
    await waitFor(() => expect(opened).toHaveBeenCalledTimes(1))
    location.hash = ''
  })

  it('reports the bridge as gone after unmount, and dispatches directly while mounted', async () => {
    const { unmount } = render(<ToolProvider persist={false}><Probe /><ToolCommandBridge /></ToolProvider>)
    act(() => queueToolCommand({ command: 'addStep', utilityId: 'trim' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    unmount()
    expect(hasToolBridge()).toBe(false)
  })

  it('ignores addStep for an id that is not a registered utility', async () => {
    render(<ToolProvider persist={false}><Probe /><ToolCommandBridge /></ToolProvider>)
    act(() => dispatchToolCommand({ command: 'addStep', utilityId: 'no_such_utility' }))
    act(() => dispatchToolCommand({ command: 'addStep', utilityId: 'trim' }))
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'))
    expect(JSON.parse(localStorage.getItem('sub:pref:recents') || '[]')).toEqual(['trim'])
  })

  it('two toggles dispatched in the same tick cancel out (no stale closure)', async () => {
    render(<ToolProvider persist={false}><Probe /><ToolCommandBridge /></ToolProvider>)
    const initialLive = screen.getByTestId('live').textContent
    const initialPreviews = screen.getByTestId('previews').textContent
    act(() => {
      dispatchToolCommand({ command: 'toggleLive' })
      dispatchToolCommand({ command: 'toggleLive' })
      dispatchToolCommand({ command: 'togglePreviews' })
      dispatchToolCommand({ command: 'togglePreviews' })
    })
    await act(async () => { await new Promise(r => setTimeout(r, 10)) })
    expect(screen.getByTestId('live').textContent).toBe(initialLive)
    expect(screen.getByTestId('previews').textContent).toBe(initialPreviews)
  })

  it('toggles live run and show-previews', async () => {
    render(<ToolProvider persist={false}><Probe /><ToolCommandBridge /></ToolProvider>)
    const initialLive = screen.getByTestId('live').textContent
    const initialPreviews = screen.getByTestId('previews').textContent

    act(() => dispatchToolCommand({ command: 'toggleLive' }))
    await waitFor(() => expect(screen.getByTestId('live').textContent).not.toBe(initialLive))

    act(() => dispatchToolCommand({ command: 'togglePreviews' }))
    await waitFor(() => expect(screen.getByTestId('previews').textContent).not.toBe(initialPreviews))
  })
})
