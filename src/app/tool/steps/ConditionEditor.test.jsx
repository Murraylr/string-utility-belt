import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ConditionEditor from './ConditionEditor'

vi.setConfig({ testTimeout: 20000 })

function Controlled({ initial, onChange }) {
  const [condition, setCondition] = useState(initial)
  return <ConditionEditor condition={condition} onChange={c => { onChange?.(c); setCondition(c) }} />
}

describe('<ConditionEditor />', () => {
  it('starts on "always" with negate disabled', () => {
    render(<ConditionEditor onChange={() => {}} />)
    expect(screen.getByLabelText('run condition').value).toBe('always')
    expect(screen.getByLabelText('negate condition')).toBeDisabled()
  })

  it('round-trips nonEmpty with negate', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText('run condition'), 'nonEmpty')
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'nonEmpty', negate: false })
    await user.click(screen.getByLabelText('negate condition'))
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'nonEmpty', negate: true })
  })

  it('round-trips a regex condition with pattern and flags', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText('run condition'), 'regex')
    await user.type(screen.getByLabelText('regex pattern'), 'foo')
    await user.type(screen.getByLabelText('regex flags'), 'i{Enter}')
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'regex', pattern: 'foo', flags: 'i', negate: false })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('commits a typed pattern once (Enter or blur), not once per keystroke', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled initial={{ kind: 'regex', pattern: '', flags: '' }} onChange={onChange} />)
    const field = screen.getByLabelText('regex pattern')
    await user.type(field, '(a|b)+')
    // nothing stored while typing: every intermediate "(" / "(a|" is an invalid regex
    expect(onChange).not.toHaveBeenCalled()
    await user.keyboard('{Enter}')
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'regex', pattern: '(a|b)+', flags: '', negate: false })

    await user.type(field, 'c')
    await user.tab()
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'regex', pattern: '(a|b)+c', flags: '', negate: false })
    // leaving an unchanged field commits nothing
    await user.click(field)
    await user.tab()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('Escape reverts an uncommitted pattern', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled initial={{ kind: 'regex', pattern: 'keep', flags: '' }} onChange={onChange} />)
    const field = screen.getByLabelText('regex pattern')
    await user.type(field, '((')
    expect(screen.getByRole('alert')).toBeTruthy()
    await user.keyboard('{Escape}')
    expect(field).toHaveValue('keep')
    expect(screen.queryByRole('alert')).toBeNull()
    await user.tab()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows a pattern changed elsewhere (e.g. undo) instead of a stale draft', () => {
    const { rerender } = render(<ConditionEditor condition={{ kind: 'regex', pattern: 'one' }} onChange={() => {}} />)
    expect(screen.getByLabelText('regex pattern')).toHaveValue('one')
    rerender(<ConditionEditor condition={{ kind: 'regex', pattern: 'two', flags: 'i' }} onChange={() => {}} />)
    expect(screen.getByLabelText('regex pattern')).toHaveValue('two')
    expect(screen.getByLabelText('regex flags')).toHaveValue('i')
  })

  it('flags an invalid regex pattern inline without throwing', async () => {
    const user = userEvent.setup()
    render(<Controlled onChange={() => {}} />)
    await user.selectOptions(screen.getByLabelText('run condition'), 'regex')
    await user.type(screen.getByLabelText('regex pattern'), '[[')
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByLabelText('regex pattern')).toHaveAttribute('aria-invalid', 'true')
  })

  it('ties the inline error to the pattern field via aria-describedby', async () => {
    const user = userEvent.setup()
    render(<Controlled onChange={() => {}} />)
    await user.selectOptions(screen.getByLabelText('run condition'), 'regex')
    await user.type(screen.getByLabelText('regex pattern'), '(')
    const alert = screen.getByRole('alert')
    expect(screen.getByLabelText('regex pattern').getAttribute('aria-describedby')).toBe(alert.id)
  })

  it('flags invalid flags even while the pattern is empty (the runner would throw)', async () => {
    const user = userEvent.setup()
    render(<Controlled onChange={() => {}} />)
    await user.selectOptions(screen.getByLabelText('run condition'), 'regex')
    await user.type(screen.getByLabelText('regex flags'), 'z')
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByLabelText('regex flags')).toHaveAttribute('aria-invalid', 'true')
  })

  it('accepts flags the runner accepts (repeated letters, g/y are ignored)', async () => {
    const user = userEvent.setup()
    render(<Controlled onChange={() => {}} />)
    await user.selectOptions(screen.getByLabelText('run condition'), 'regex')
    await user.type(screen.getByLabelText('regex pattern'), 'a')
    await user.type(screen.getByLabelText('regex flags'), 'iigy')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('lets an imported "always + negate" (never runs) be un-negated back to the default', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled initial={{ kind: 'always', negate: true }} onChange={onChange} />)
    const negate = screen.getByLabelText('negate condition')
    expect(negate).not.toBeDisabled()
    expect(negate).toBeChecked()
    await user.click(negate)
    expect(onChange).toHaveBeenLastCalledWith(undefined)
    expect(screen.getByLabelText('negate condition')).toBeDisabled()
  })

  it('round-trips a type condition', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText('run condition'), 'type')
    await user.selectOptions(screen.getByLabelText('input type'), 'bytes')
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'type', type: 'bytes', negate: false })
  })

  it('clears the condition entirely when set back to always', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled initial={{ kind: 'nonEmpty', negate: true }} onChange={onChange} />)
    await user.selectOptions(screen.getByLabelText('run condition'), 'always')
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })
})
