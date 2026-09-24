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
  it('renders step index text', () => {
    render(<StepCard index={0} step={{ enabled: true, utilityId: 'trim', params: {} }} total={1} onMoveUp={() => {}} onMoveDown={() => {}} onDelete={() => {}} onToggle={() => {}} onChangeParams={() => {}} onChangeUtil={() => {}} />)
    expect(screen.getByText('step 1')).toBeTruthy()
  })

  it('links to the utility docs page', () => {
    render(<StepCard {...baseProps} />)
    expect(screen.getByRole('link', { name: /docs$/ })).toHaveAttribute('href', '#/util/trim')
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
    expect(screen.getByText('if matches /foo/i')).toBeTruthy()
    expect(screen.getByText('on error: stop')).toBeTruthy()
  })

  it('gives the utility select an accessible name', () => {
    render(<StepCard {...baseProps} />)
    expect(screen.getByLabelText('utility')).toHaveValue('trim')
  })

  it('highlights the card of a step that errored, with the message inline', () => {
    const { container } = render(<StepCard {...baseProps} error="bad input" />)
    expect(screen.getByRole('alert').textContent).toBe('bad input')
    expect(container.querySelector('[data-step-id]').className).toMatch(/border-danger/)
  })

  it('offers copy and diff controls in the preview header', async () => {
    const user = userEvent.setup()
    render(<StepCard {...baseProps} input="same" preview="same" />)
    expect(screen.getByRole('button', { name: 'copy' })).toBeTruthy()
    const toggle = screen.getByRole('button', { name: 'toggle diff view' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByText('no textual change')).toBeTruthy()
  })

  it('describeCondition summarises every kind, including negation', () => {
    expect(describeCondition(undefined)).toBeNull()
    expect(describeCondition({ kind: 'nonEmpty' })).toBe('if non-empty')
    expect(describeCondition({ kind: 'nonEmpty', negate: true })).toBe('if not non-empty')
    expect(describeCondition({ kind: 'type', type: 'json' })).toBe('if type is json')
    expect(describeCondition({ kind: 'regex', pattern: 'a+', flags: 'i', negate: true })).toBe('if not matches /a+/i')
    expect(describeCondition({ kind: 'always' })).toBeNull()
    expect(describeCondition({ kind: 'always', negate: true })).toMatch(/never runs/)
  })

  it('colors the timing chip warn above 100ms', () => {
    const { rerender } = render(<StepCard {...baseProps} ms={40} />)
    expect(screen.getByText('40 ms').className).not.toMatch(/text-warn/)
    rerender(<StepCard {...baseProps} ms={150} />)
    expect(screen.getByText('150 ms').className).toMatch(/text-warn/)
  })

  it('labels a halted or condition-skipped step', () => {
    const { rerender } = render(<StepCard {...baseProps} skipped="halted" />)
    expect(screen.getByText('not run: pipeline stopped')).toBeTruthy()
    rerender(<StepCard {...baseProps} skipped="condition" />)
    expect(screen.getByText('skipped: condition')).toBeTruthy()
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
    await user.click(screen.getByRole('button', { name: 'advanced' }))
    await user.selectOptions(screen.getByLabelText('run condition'), 'nonEmpty')
    expect(onUpdateStep).toHaveBeenCalledWith({ condition: { kind: 'nonEmpty', negate: false } })
    await user.selectOptions(screen.getByLabelText('on error'), 'stop')
    expect(onUpdateStep).toHaveBeenCalledWith({ onError: 'stop' })
    expect(screen.getByText('if non-empty')).toBeTruthy()
    expect(screen.getByText('on error: stop')).toBeTruthy()

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
    await user.click(screen.getByRole('button', { name: 'advanced' }))
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
    expect(screen.getAllByText(/^step \d+$/)).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /step 1 menu/i }))
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }))
    expect(screen.getAllByText(/^step \d+$/)).toHaveLength(2)
  })

  it('toggles a diff view of the step input vs. its preview', async () => {
    const user = userEvent.setup()
    // JS string expressions: a JSX attribute string would keep "\n" as two literal characters
    render(<StepCard {...baseProps} input={'a\nb\nc'} preview={'a\nx\nc'} />)
    await user.click(screen.getByRole('button', { name: 'toggle diff view' }))
    const group = await screen.findByRole('group', { name: 'step diff' })
    expect(group.textContent).toContain('- b')
    expect(group.textContent).toContain('+ x')
    expect(group.textContent).not.toContain('- a')
  })
})
