import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { PipelineStep } from '@/types/utility'
import { ToolProvider, useTool } from '@/app/ToolContext'
import MagicButton from './MagicButton'
import { clampedPanelLeft } from './panelPosition'

function Steps() {
  const { state, dispatch, run } = useTool()
  return (
    <>
      <pre data-testid="steps">{JSON.stringify(state.steps.map(s => ('utilityId' in s ? [s.utilityId, s.params] : s.id)))}</pre>
      <pre data-testid="out">{run.result && !run.running ? String(run.result.out) : ''}</pre>
      <button type="button" onClick={() => run.runNow()}>run now</button>
      <button type="button" onClick={() => dispatch({ type: 'ADD_STEP', utilityId: 'reverse', params: {} })}>add reverse</button>
    </>
  )
}

const stepsShown = () => JSON.parse(screen.getByTestId('steps').textContent || '[]') as [string, unknown][]

function Harness({ initialInput, initialSteps = [] }: { initialInput?: string; initialSteps?: PipelineStep[] }) {
  return (
    <ToolProvider initialSteps={initialSteps} initialInput={initialInput} persist={false}>
      <textarea aria-label="outside field" />
      <Steps />
      <MagicButton />
    </ToolProvider>
  )
}

afterEach(() => {
  localStorage.removeItem('string-utility-belt')
  localStorage.removeItem('sub:pref:liveRun')
})

describe('clampedPanelLeft', () => {
  it('right-aligns to the button when there is room (desktop-ish toolbar)', () => {
    // a 900px-wide viewport, button sitting far from either edge
    const { left, width } = clampedPanelLeft(700, 500, 900)
    expect(width).toBe(320)
    expect(left).toBe(700 - 320 - 500) // unclamped: right-aligned to the button
  })

  it('clamps to the left viewport gutter instead of running off-screen (mobile, button near the left edge)', () => {
    // regression: a toolbar button at the left edge of a 375px viewport used to push
    // the panel to a negative x — permanently off-screen and unreachable
    const { left, width } = clampedPanelLeft(70, 8, 375)
    expect(width).toBe(320) // 375px still fits the full 320px panel with both gutters
    expect(left + 8).toBeGreaterThanOrEqual(16) // final viewport position respects the gutter
  })

  it('clamps to the right viewport gutter when the button sits at the right edge', () => {
    const { left, width } = clampedPanelLeft(375, 300, 375)
    expect(left + 300 + width).toBeLessThanOrEqual(375 - 16)
  })

  it('shrinks the panel to fit an even narrower viewport', () => {
    const { width } = clampedPanelLeft(300, 0, 300)
    expect(width).toBe(300 - 32)
  })
})

describe('MagicButton', () => {
  it('does not steal focus when it mounts', () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    field.focus()
    try {
      render(<Harness initialInput="" />)
      expect(document.activeElement).toBe(field)
    } finally {
      field.remove()
    }
  })

  it('opens a labelled dialog on click and closes on Escape, returning focus', async () => {
    render(<Harness initialInput="" />)
    const trigger = screen.getByRole('button', { name: /magic/i })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: /magic decode/i })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(trigger.getAttribute('aria-expanded')).toBe('true')

    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(trigger)
  })

  it('traps Tab inside the dialog even when "Decode all the way" is disabled', async () => {
    render(<Harness initialInput="" />)
    fireEvent.click(screen.getByRole('button', { name: /magic/i }))
    await screen.findByRole('dialog')
    const close = screen.getByRole('button', { name: /close magic decode/i })
    expect(screen.getByRole('button', { name: 'Decode all the way' })).toBeDisabled()

    close.focus()
    // not prevented => the browser would move focus past the disabled button, out of the dialog
    expect(fireEvent.keyDown(close, { key: 'Tab' })).toBe(false)
    expect(document.activeElement).toBe(close)
    expect(fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(document.activeElement).toBe(close)
  })

  it('keeps Shift+Tab from the dialog container inside the dialog', async () => {
    render(<Harness initialInput="" />)
    fireEvent.click(screen.getByRole('button', { name: /magic/i }))
    const dialog = await screen.findByRole('dialog')
    expect(document.activeElement).toBe(dialog)
    expect(fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })).toBe(false)
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('closes on a click outside without pulling focus back to the trigger', async () => {
    render(<Harness initialInput="" />)
    fireEvent.click(screen.getByRole('button', { name: /magic/i }))
    await screen.findByRole('dialog')
    const outside = screen.getByLabelText('outside field')
    fireEvent.pointerDown(outside)
    outside.focus()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(outside)
  })

  it('opens on the sub:magic window event', async () => {
    render(<Harness initialInput="" />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent(window, new Event('sub:magic'))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('shows a helpful message for empty input', async () => {
    render(<Harness initialInput="" />)
    fireEvent.click(screen.getByRole('button', { name: /magic/i }))
    expect(await screen.findByText(/nothing to analyse yet/i)).toBeTruthy()
  })

  it('suggests base64 decode and appends the step on click', async () => {
    render(<Harness initialInput={btoa('Hello, World!')} />)
    fireEvent.click(screen.getByRole('button', { name: /magic/i }))
    const suggestion = await screen.findByText('base64 decode', {}, { timeout: 5000 })
    expect(stepsShown()).toEqual([])

    fireEvent.click(suggestion)

    await waitFor(() => expect(stepsShown().map(s => s[0])).toEqual(['base64_decode']))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('seeds the picked utility\'s default params, like the picker does', async () => {
    render(<Harness initialInput={'{"a":1}'} />)
    fireEvent.click(screen.getByRole('button', { name: /magic/i }))
    fireEvent.click(await screen.findByText('JSON pretty-print', {}, { timeout: 5000 }))
    await waitFor(() => expect(stepsShown()).toEqual([['json_pretty', { indent: 2 }]]))
  })

  it('analyses the pipeline output, appending after the existing steps', async () => {
    const steps: PipelineStep[] = [{ id: 's1', utilityId: 'base64_encode', params: {}, enabled: true }]
    render(<Harness initialInput="Hello, World!" initialSteps={steps} />)
    fireEvent.click(screen.getByRole('button', { name: /magic/i }))
    fireEvent.click(await screen.findByText('base64 decode', {}, { timeout: 5000 }))
    await waitFor(() => expect(stepsShown().map(s => s[0])).toEqual(['base64_encode', 'base64_decode']))
  })

  it('does not analyse the raw input when the pipeline has steps but no run result yet', async () => {
    localStorage.setItem('sub:pref:liveRun', 'false') // manual mode: nothing has run
    const steps: PipelineStep[] = [{ id: 's1', utilityId: 'trim', params: {}, enabled: true }]
    render(<Harness initialInput={btoa('Hello, World!')} initialSteps={steps} />)
    fireEvent.click(screen.getByRole('button', { name: /magic/i }))
    expect(await screen.findByText(/run the pipeline/i)).toBeTruthy()
    // the input's base64 is not the pipeline's output: suggesting a decoder for it would be wrong
    await new Promise(r => setTimeout(r, 300))
    expect(screen.queryByText('base64 decode')).toBeNull()
  })

  it('does not analyse an output that no longer matches the pipeline (manual mode, edited since the run)', async () => {
    localStorage.setItem('sub:pref:liveRun', 'false')
    const steps: PipelineStep[] = [{ id: 's1', utilityId: 'base64_encode', params: {}, enabled: true }]
    render(<Harness initialInput="Hello, World!" initialSteps={steps} />)
    fireEvent.click(screen.getByRole('button', { name: 'run now' }))
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe(btoa('Hello, World!')), { timeout: 5000 })

    // the pipeline changes but is not re-run: the output shown is now out of date
    fireEvent.click(screen.getByRole('button', { name: 'add reverse' }))
    fireEvent.click(screen.getByRole('button', { name: /^magic$/i }))
    expect(await screen.findByText(/run the pipeline/i)).toBeTruthy()
    await new Promise(r => setTimeout(r, 300))
    // "base64 decode" fits the stale output, but appended after `reverse` it would fail
    expect(screen.queryByText('base64 decode')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'run now' }))
    await waitFor(() => expect(screen.getByTestId('out').textContent).toBe(btoa('Hello, World!').split('').reverse().join('')), { timeout: 5000 })
    expect(screen.queryByText(/run the pipeline/i)).toBeNull()
  })

  it('"Decode all the way" appends the whole chain', async () => {
    const obj = { a: 1, b: 'x y' }
    render(<Harness initialInput={btoa(encodeURIComponent(JSON.stringify(obj)))} />)
    fireEvent.click(screen.getByRole('button', { name: /magic/i }))
    await screen.findByText('base64 decode', {}, { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: 'Decode all the way' }))
    await waitFor(() => expect(stepsShown()).toEqual([
      ['base64_decode', {}],
      ['url_decode', {}],
      ['json_pretty', { indent: 2 }],
    ]), { timeout: 10000 })
    expect(screen.queryByRole('dialog')).toBeNull()
  }, 15000)
})
