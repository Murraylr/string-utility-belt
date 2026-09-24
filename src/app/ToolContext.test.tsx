import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { PipelineStep } from '@/types/utility'
import { ToolProvider, useTool } from './ToolContext'

// html_to_markdown needs the DOM, so it can only ever run on the main thread
const mainThreadOnly: PipelineStep[] = [{ id: 'h', utilityId: 'html_to_markdown', enabled: true, params: {} }]
const workerSafe: PipelineStep[] = [{ id: 'u', utilityId: 'case', enabled: true, params: { mode: 'upper' } }]

function Probe() {
  const { run, runHeld } = useTool()
  return (
    <div>
      <span data-testid="held">{String(runHeld)}</span>
      <span data-testid="out">{run.result ? String(run.result.out) : ''}</span>
      <button onClick={run.runNow}>run</button>
    </div>
  )
}

const renderTool = (steps: PipelineStep[], untrusted: boolean) =>
  render(
    <ToolProvider initialSteps={steps} initialInput="<b>hi</b>" persist={false} untrusted={untrusted}>
      <Probe />
    </ToolProvider>,
  )

describe('ToolProvider run hold for untrusted main-thread pipelines', () => {
  afterEach(() => localStorage.clear())

  it('does not auto-run a shared pipeline that can only run on the main thread until Run is clicked', async () => {
    renderTool(mainThreadOnly, true)
    expect(screen.getByTestId('held').textContent).toBe('true')
    await act(() => new Promise(r => setTimeout(r, 150)))
    expect(screen.getByTestId('out').textContent).toBe('')

    fireEvent.click(screen.getByText('run'))
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('**hi**'), { timeout: 5000 })
    expect(screen.getByTestId('held').textContent).toBe('false')
  })

  it('auto-runs a shared pipeline that can run in the worker', async () => {
    renderTool(workerSafe, true)
    expect(screen.getByTestId('held').textContent).toBe('false')
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('<B>HI</B>'), { timeout: 5000 })
  })

  it('auto-runs the user\'s own main-thread pipeline', async () => {
    renderTool(mainThreadOnly, false)
    expect(screen.getByTestId('held').textContent).toBe('false')
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe('**hi**'), { timeout: 5000 })
  })
})
