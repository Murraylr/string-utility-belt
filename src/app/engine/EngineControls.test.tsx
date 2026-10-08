import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider, useTool } from '@/app/ToolContext'
import EngineControls from './EngineControls'
import LargeInputBanner from './LargeInputBanner'
import { SIZE_GUARD } from './useRunner'
import { writePref } from '@/app/prefs'

/** Where the last run ran and whether it was partial (the output panel shows this, not the controls). */
function RunProbe() {
  const { run } = useTool()
  return <span data-testid="run">{run.where ? `${run.where}${run.partial ? ' partial' : ''}` : ''}</span>
}

function renderWithTool(ui: React.ReactNode, initialInput = '') {
  return render(
    <ToolProvider initialSteps={[]} initialInput={initialInput} persist={false}>
      {ui}
      <RunProbe />
    </ToolProvider>,
  )
}

const lastRun = () => screen.getByTestId('run').textContent

afterEach(() => localStorage.clear())

describe('EngineControls', () => {
  it('renders the live/manual toggle, and no timing of its own (the output panel shows it)', async () => {
    renderWithTool(<EngineControls />, 'hello')
    expect(screen.getByRole('button', { name: 'Live' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Manual' })).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(lastRun()).toBe('main'))
    expect(screen.getByRole('group', { name: 'engine controls' })).not.toHaveTextContent(/\d+\s?ms/)
  })

  it('switching to Manual enables the Run button; switching back to Live disables it', async () => {
    const user = userEvent.setup()
    renderWithTool(<EngineControls />, 'hello')
    const runButton = screen.getByRole('button', { name: 'Run' })
    expect(runButton).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Manual' }))
    expect(runButton).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Live' }))
    expect(runButton).toBeDisabled()
  })

  it('toggles the "preview first 64 KB" pref', async () => {
    const user = userEvent.setup()
    renderWithTool(<EngineControls />, 'hello')
    const checkbox = screen.getByRole('checkbox', { name: /first 64 kb/i })
    expect(checkbox).not.toBeChecked()
    await user.click(checkbox)
    expect(checkbox).toBeChecked()
    expect(JSON.parse(localStorage.getItem('sub:pref:previewLimit')!)).toBe(true)
  })

  it('is a labelled group, and the pressed mode is visually distinct (not just aria-pressed)', () => {
    renderWithTool(<EngineControls />, 'hello')
    expect(screen.getByRole('group', { name: 'engine controls' })).toBeInTheDocument()
    const live = screen.getByRole('button', { name: 'Live' })
    expect(live.className).toMatch(/aria-pressed:/)
  })

  it('in live mode, enables Run while the result is only a 64 KB preview, and Run replaces it with the full result', async () => {
    writePref('previewLimit', true)
    const user = userEvent.setup()
    const bigish = Array.from({ length: 400 }, () => 'y'.repeat(200)).join('\n') // > 64 KB, < SIZE_GUARD
    renderWithTool(<EngineControls />, bigish)
    await waitFor(() => expect(lastRun()).toBe('main partial'))
    const runButton = screen.getByRole('button', { name: 'Run' })
    expect(runButton).toBeEnabled()
    await user.click(runButton)
    await waitFor(() => expect(lastRun()).toBe('main'))
    expect(runButton).toBeDisabled()
  })

  it('shows no large-input banner for ordinary input', async () => {
    renderWithTool(<EngineControls />, 'hello')
    await waitFor(() => expect(lastRun()).toBe('main'))
    expect(screen.queryByText(/live preview paused/i)).not.toBeInTheDocument()
  })
})

describe('LargeInputBanner', () => {
  it('shows no banner for input under the size guard, but keeps its (empty) live region mounted', () => {
    renderWithTool(<LargeInputBanner />, 'small input')
    // a live region inserted together with its text is not reliably announced;
    // the region must already exist when the banner text appears
    const region = screen.getByRole('status')
    expect(region).toBeEmptyDOMElement()
    expect(screen.queryByRole('button', { name: /run full input/i })).not.toBeInTheDocument()
  })

  it('announces the banner through the same live region that was already mounted', async () => {
    function Harness() {
      const { setInput } = useTool()
      return <button type="button" onClick={() => setInput('x'.repeat(SIZE_GUARD + 1))}>paste big</button>
    }
    const user = userEvent.setup()
    renderWithTool(<><Harness /><LargeInputBanner /></>, 'small')
    const region = screen.getByRole('status')
    await user.click(screen.getByRole('button', { name: 'paste big' }))
    expect(screen.getByRole('status')).toBe(region)
    expect(region).toHaveTextContent(/live preview paused/i)
  })

  it('shows the paused message, and its Run button actually runs the full input', async () => {
    const user = userEvent.setup()
    const big = 'x'.repeat(SIZE_GUARD + 1)
    renderWithTool(<EngineControls />, big)
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(/large input \(1\.0 MB\) — live preview paused/i)
    expect(lastRun()).toBe('') // nothing has run yet
    await user.click(within(banner).getByRole('button', { name: /run full input/i }))
    // an empty pipeline over a huge string is line-chunkable, so it runs chunked
    await waitFor(() => expect(lastRun()).toBe('chunked'))
    // still paused for the next edit: the banner stays
    expect(screen.getByRole('status')).toHaveTextContent(/live preview paused/i)
  })

  it('with "preview first 64 KB" on, says the live preview is partial instead of paused', async () => {
    writePref('previewLimit', true)
    renderWithTool(<LargeInputBanner />, 'x'.repeat(SIZE_GUARD + 1))
    const banner = await screen.findByRole('status')
    expect(banner).toHaveTextContent(/first 64 KB/i)
    expect(banner).not.toHaveTextContent(/paused/i)
  })
})
