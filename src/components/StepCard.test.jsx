import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import StepCard from './StepCard'
import { describeCondition } from '@/app/tool/steps/status'
import { ToolProvider, useTool } from '@/app/ToolContext'

// Several tests drive multiple userEvent interactions against a mounted card;
// give them headroom over vitest's 5s default on a loaded machine.
vi.setConfig({ testTimeout: 20000 })

const baseProps = {
  index: 0,
  step: { id: 's1', enabled: true, utilityId: 'trim', params: {} },
  total: 1,
  onMoveUp: () => {},
  onMoveDown: () => {},
  onDelete: () => {},
  onToggle: () => {},
  onChangeParams: () => {},
  onChangeUtil: () => {},
}

describe('StepCard', () => {
  it('names the step by its utility, with its category and signature', () => {
    render(<StepCard {...baseProps} />)
    expect(screen.getByRole('button', { name: 'trim, change utility' })).toBeTruthy()
    expect(screen.getByText('String Ops')).toBeTruthy()
    expect(screen.getByText('text → text')).toBeTruthy()
  })

  it('shows a renamed step by its label, keeping the utility in the sub line', () => {
    render(<StepCard {...baseProps} step={{ ...baseProps.step, label: 'tidy' }} />)
    expect(screen.getByRole('button', { name: 'tidy, change utility' })).toBeTruthy()
    expect(screen.getByText('trim · String Ops')).toBeTruthy()
  })

  it('links to the utility docs page by its crawlable path', () => {
    render(<StepCard {...baseProps} />)
    expect(screen.getByRole('link', { name: 'trim docs' })).toHaveAttribute('href', '/util/trim/')
  })

  it('shows no docs link for an unknown utility', () => {
    render(<StepCard {...baseProps} step={{ ...baseProps.step, utilityId: 'nope' }} />)
    expect(screen.queryByRole('link', { name: /docs$/ })).toBeNull()
  })

  it('shows no condition/error/skip chips for a plain step', () => {
    render(<StepCard {...baseProps} />)
    expect(screen.queryByTitle('run condition')).toBeNull()
    expect(screen.queryByTitle('error policy')).toBeNull()
  })

  it('shows a chip summarising a non-default condition and error policy', () => {
    const step = { ...baseProps.step, condition: { kind: 'regex', pattern: 'foo', flags: 'i' }, onError: 'stop' }
    render(<StepCard {...baseProps} step={step} />)
    expect(screen.getByText('if /foo/i')).toBeTruthy()
    expect(screen.getByText('stops on error')).toBeTruthy()
  })

  it('changes the utility from a picker opened on the step name', async () => {
    const user = userEvent.setup()
    const onChangeUtil = vi.fn()
    render(<StepCard {...baseProps} onChangeUtil={onChangeUtil} />)
    const name = screen.getByRole('button', { name: 'trim, change utility' })
    await user.click(name)
    expect(name).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Pick a new utility for step 1')).toBeTruthy()
    await user.type(screen.getByRole('combobox', { name: 'Search utilities' }), 'reverse{Enter}')
    expect(onChangeUtil).toHaveBeenCalledWith('reverse')
    expect(screen.queryByRole('combobox', { name: 'Search utilities' })).toBeNull()
    expect(name).toHaveFocus()
  })

  it('highlights the card of a step that errored, with the message inline', () => {
    const { container } = render(<StepCard {...baseProps} error="bad input" />)
    expect(screen.getByRole('alert').textContent).toBe('bad input Passed its input on unchanged.')
    expect(container.querySelector('[data-step-id]').className).toMatch(/border-danger/)
  })

  it('offers copy and diff controls in the preview header', async () => {
    const user = userEvent.setup()
    render(<StepCard {...baseProps} input="same" preview="same" />)
    expect(screen.getByRole('button', { name: 'copy' })).toBeTruthy()
    const toggle = screen.getByRole('button', { name: 'Diff' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('no textual change')).toBeTruthy()
  })

  it('describeCondition summarises every kind, including negation', () => {
    expect(describeCondition(undefined)).toBeNull()
    expect(describeCondition({ kind: 'nonEmpty' })).toBe('if not empty')
    expect(describeCondition({ kind: 'nonEmpty', negate: true })).toBe('if empty')
    expect(describeCondition({ kind: 'type', type: 'json' })).toBe('if json')
    expect(describeCondition({ kind: 'type', type: 'string', negate: true })).toBe('unless text')
    expect(describeCondition({ kind: 'regex', pattern: 'a+', flags: 'i', negate: true })).toBe('unless /a+/i')
    expect(describeCondition({ kind: 'always' })).toBeNull()
    expect(describeCondition({ kind: 'always', negate: true })).toBe('never runs')
  })

  it('colors the timing chip warn above 100ms', () => {
    const { rerender } = render(<StepCard {...baseProps} ms={40} />)
    expect(screen.getByText('40 ms').className).not.toMatch(/text-warn/)
    rerender(<StepCard {...baseProps} ms={150} />)
    expect(screen.getByText('150 ms').className).toMatch(/text-warn/)
  })

  it('says why the last run did not execute a step, or that it is off', () => {
    const { rerender } = render(<StepCard {...baseProps} skipped="halted" />)
    expect(screen.getByText('Not run: the pipeline stopped at an earlier step.')).toBeTruthy()
    rerender(<StepCard {...baseProps} skipped="condition" />)
    expect(screen.getByText('Skipped: the run condition wasn’t met, so the input passed through.')).toBeTruthy()
    rerender(<StepCard {...baseProps} step={{ ...baseProps.step, enabled: false }} />)
    expect(screen.getByText('Off. Its input passes through unchanged.')).toBeTruthy()
    expect(screen.getByRole('switch', { name: 'toggle step 1' })).not.toBeChecked()
  })

  it('expands the advanced section and edits condition/error policy, round-tripping to the UI', async () => {
    const user = userEvent.setup()
    const onUpdateStep = vi.fn()
    function Harness() {
      const [step, setStep] = useState(baseProps.step)
      const update = patch => {
        onUpdateStep(patch)
        setStep(s => {
          const next = { ...s, ...patch }
          for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k]
          return next
        })
      }
      return <StepCard {...baseProps} step={step} onUpdateStep={update} />
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    await user.selectOptions(screen.getByLabelText('run condition'), 'nonEmpty')
    expect(onUpdateStep).toHaveBeenCalledWith({ condition: { kind: 'nonEmpty', negate: false } })
    await user.selectOptions(screen.getByLabelText('on error'), 'stop')
    expect(onUpdateStep).toHaveBeenCalledWith({ onError: 'stop' })
    expect(screen.getByText('if not empty')).toBeTruthy()
    expect(screen.getByText('stops on error')).toBeTruthy()

    // back to defaults clears both fields from the step (chips disappear)
    await user.selectOptions(screen.getByLabelText('run condition'), 'always')
    expect(onUpdateStep).toHaveBeenLastCalledWith({ condition: undefined })
    await user.selectOptions(screen.getByLabelText('on error'), 'passthrough')
    expect(onUpdateStep).toHaveBeenLastCalledWith({ onError: undefined })
    expect(screen.queryByTitle('run condition')).toBeNull()
    expect(screen.queryByTitle('error policy')).toBeNull()
  })

  it('the condition editor round-trips to regex mode and flags an invalid pattern', async () => {
    const user = userEvent.setup()
    function Harness() {
      const [step, setStep] = useState(baseProps.step)
      const update = patch => setStep(s => ({ ...s, ...patch }))
      return <StepCard {...baseProps} step={step} onUpdateStep={update} />
    }
    render(<Harness />)
    await user.click(screen.getByRole('button', { name: 'Advanced' }))
    await user.selectOptions(screen.getByLabelText('run condition'), 'regex')
    await user.type(screen.getByLabelText('regex pattern'), '(')
    expect(screen.getByRole('alert')).toBeTruthy()
    await user.clear(screen.getByLabelText('regex pattern'))
    await user.type(screen.getByLabelText('regex pattern'), 'ok')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('menu actions call explicit duplicate/solo/rename callbacks', async () => {
    const user = userEvent.setup()
    const onDuplicate = vi.fn()
    const onSolo = vi.fn()
    const onRename = vi.fn()
    render(<StepCard {...baseProps} onDuplicate={onDuplicate} onSolo={onSolo} onRename={onRename} />)

    await user.click(screen.getByRole('button', { name: /step 1 menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(onDuplicate).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /step 1 menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Solo' }))
    expect(onSolo).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /step 1 menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }))
    const input = screen.getByLabelText('step name')
    await user.type(input, 'my step{enter}')
    expect(onRename).toHaveBeenCalledWith('my step')
  })

  it('the menu supports arrow-key navigation and Escape returns focus to the trigger', async () => {
    const user = userEvent.setup()
    render(<StepCard {...baseProps} />)
    const trigger = screen.getByRole('button', { name: /step 1 menu/i })
    await user.click(trigger)
    const items = screen.getAllByRole('menuitem')
    expect(items[0]).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(items[1]).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('falls back to dispatching on the ToolProvider when no explicit menu callbacks are given', async () => {
    const user = userEvent.setup()
    function Harness() {
      const { state } = useTool()
      return (
        <>
          {state.steps.map((s, i) => (
            <StepCard key={s.id} index={i} step={s} total={state.steps.length}
              onMoveUp={() => {}} onMoveDown={() => {}} onDelete={() => {}} onToggle={() => {}}
              onChangeParams={() => {}} onChangeUtil={() => {}} />
          ))}
        </>
      )
    }
    render(<ToolProvider initialSteps={[{ id: 's1', enabled: true, utilityId: 'trim', params: {} }]} persist={false}><Harness /></ToolProvider>)
    expect(document.querySelectorAll('[data-step-id]')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /step 1 menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(document.querySelectorAll('[data-step-id]')).toHaveLength(2)
  })

  it('toggles a diff view of the step input vs. its preview', async () => {
    const user = userEvent.setup()
    // JS string expressions: a JSX attribute string would keep "\n" as two literal characters
    render(<StepCard {...baseProps} input={'a\nb\nc'} preview={'a\nx\nc'} />)
    await user.click(screen.getByRole('button', { name: 'Diff' }))
    const group = await screen.findByRole('group', { name: 'step diff' })
    expect(group.textContent).toContain('- b')
    expect(group.textContent).toContain('+ x')
    expect(group.textContent).not.toContain('- a')
  })
})
