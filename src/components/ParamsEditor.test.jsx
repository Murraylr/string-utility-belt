import { useState } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ParamsEditor from './ParamsEditor'

// Keep the lazy CodeMirror chunk pending forever here, so every `code` param in this file
// deterministically shows the Suspense fallback (the real editor is covered by
// params/CodeEditor.test.jsx and the swap by params/CodeParam.test.jsx).
vi.mock('./params/CodeEditor', () => new Promise(() => {}))

/** Controlled harness: feeds each onChange back in, like StepCard does. */
function Stateful({ spec, initial = {}, onChange = () => {}, ...rest }) {
  const [params, setParams] = useState(initial)
  return <ParamsEditor spec={spec} params={params} onChange={p => { setParams(p); onChange(p) }} {...rest} />
}

describe('ParamsEditor', () => {
  it('renders string input and updates value', () => {
    const spec = { pattern: { kind: 'string', label: 'pattern', default: '' } }
    const onChange = vi.fn()
    render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'abc' } })
    expect(onChange).toHaveBeenCalledWith({ pattern: 'abc' })
  })

  it('string: shows a required error and wires aria-invalid/aria-describedby', () => {
    const spec = { name: { kind: 'string', label: 'name', required: true } }
    render(<ParamsEditor spec={spec} params={{}} onChange={() => {}} idPrefix="p" />)
    const input = screen.getByLabelText('name')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'p-name-error')
    expect(screen.getByRole('alert')).toHaveTextContent('required')
  })

  it('number: emits a numeric payload, keeps "" when cleared, and flags out-of-range values', () => {
    const spec = { n: { kind: 'number', label: 'n', min: 0, max: 10, default: 5 } }
    const onChange = vi.fn()
    const { rerender } = render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    const input = screen.getByRole('spinbutton')
    fireEvent.change(input, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith({ n: 7 })
    fireEvent.change(input, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ n: '' })

    rerender(<ParamsEditor spec={spec} params={{ n: 20 }} onChange={onChange} />)
    expect(screen.getByRole('alert')).toHaveTextContent('at most 10')
  })

  it('boolean: renders a checkbox and toggles', () => {
    const spec = { flag: { kind: 'boolean', label: 'flag', default: false } }
    const onChange = vi.fn()
    render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onChange).toHaveBeenCalledWith({ flag: true })
  })

  it('select: renders options and emits the chosen one', () => {
    const spec = { mode: { kind: 'select', label: 'mode', options: ['a', 'b', 'c'], default: 'a' } }
    const onChange = vi.fn()
    render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'b' } })
    expect(onChange).toHaveBeenCalledWith({ mode: 'b' })
  })

  it('code: shows the Suspense fallback textarea in jsdom and preserves an edit made before the editor chunk loads', () => {
    const spec = { src: { kind: 'code', label: 'source', language: 'json', default: '' } }
    const onChange = vi.fn()
    render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    const textarea = screen.getByRole('textbox')
    fireEvent.change(textarea, { target: { value: '{"a":1}' } })
    expect(onChange).toHaveBeenCalledWith({ src: '{"a":1}' })
  })

  it('textarea: renders with the requested row count and updates value', () => {
    const spec = { body: { kind: 'textarea', label: 'body', rows: 6, default: '' } }
    const onChange = vi.fn()
    render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('rows', '6')
    fireEvent.change(textarea, { target: { value: 'line one\nline two' } })
    expect(onChange).toHaveBeenCalledWith({ body: 'line one\nline two' })
  })

  it('regex: reports an invalid pattern as an inline error', () => {
    const spec = { pattern: { kind: 'regex', label: 'pattern' } }
    render(<ParamsEditor spec={spec} params={{ pattern: '(' }} onChange={() => {}} />)
    expect(screen.getByRole('alert')).toBeTruthy()
  })

  it('regex: counts matches against sampleInput using the sibling flags param', () => {
    const spec = {
      pattern: { kind: 'regex', label: 'pattern', flagsParam: 'flags' },
      flags: { kind: 'string', label: 'flags', default: 'i' },
    }
    render(
      <ParamsEditor
        spec={spec}
        params={{ pattern: 'a', flags: 'i' }}
        onChange={() => {}}
        sampleInput="Aaa banana"
      />
    )
    // case-insensitive: A,a,a + the three a's in "banana" = 6
    expect(screen.getByText(/6 matches in sample/)).toBeTruthy()
  })

  it('regex: onChange still fires normally', () => {
    const spec = { pattern: { kind: 'regex', label: 'pattern' } }
    const onChange = vi.fn()
    render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('pattern'), { target: { value: '\\d+' } })
    expect(onChange).toHaveBeenCalledWith({ pattern: '\\d+' })
  })

  describe('keyvalue', () => {
    const spec = { pairs: { kind: 'keyvalue', label: 'pairs', keyLabel: 'find', valueLabel: 'replace' } }

    it('adds a row', () => {
      const onChange = vi.fn()
      render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: /add row/i }))
      expect(onChange).toHaveBeenCalledWith({ pairs: [['', '']] })
    })

    it('edits a pair and emits the full array', () => {
      const onChange = vi.fn()
      render(<ParamsEditor spec={spec} params={{ pairs: [['a', 'b']] }} onChange={onChange} />)
      fireEvent.change(screen.getByLabelText('find 1'), { target: { value: 'x' } })
      expect(onChange).toHaveBeenCalledWith({ pairs: [['x', 'b']] })
    })

    it('removes a row', () => {
      const onChange = vi.fn()
      render(<ParamsEditor spec={spec} params={{ pairs: [['a', 'b']] }} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: /remove row 1/i }))
      expect(onChange).toHaveBeenCalledWith({ pairs: [] })
    })

    it('moves a row down', () => {
      const onChange = vi.fn()
      render(<ParamsEditor spec={spec} params={{ pairs: [['a', '1'], ['b', '2']] }} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: /move row 1 down/i }))
      expect(onChange).toHaveBeenCalledWith({ pairs: [['b', '2'], ['a', '1']] })
    })

    it('tolerates a legacy string value and converts it into pairs', () => {
      const onChange = vi.fn()
      render(<ParamsEditor spec={spec} params={{ pairs: 'foo => bar\nbaz\tqux' }} onChange={onChange} />)
      expect(screen.getByText(/legacy value/)).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: /convert to pairs/i }))
      expect(onChange).toHaveBeenCalledWith({ pairs: [['foo', 'bar'], ['baz', 'qux']] })
    })
  })

  describe('file', () => {
    let originalFileReader
    let readAsTextSpy
    let readAsDataURLSpy

    beforeEach(() => {
      originalFileReader = global.FileReader
      // Spy on jsdom's real FileReader (which does correctly read File content
      // in this environment) so the test also verifies FileParam calls it.
      class FileReaderSpy extends originalFileReader {
        readAsText(...args) { readAsTextSpy(...args); return super.readAsText(...args) }
        readAsDataURL(...args) { readAsDataURLSpy(...args); return super.readAsDataURL(...args) }
      }
      readAsTextSpy = vi.fn()
      readAsDataURLSpy = vi.fn()
      global.FileReader = FileReaderSpy
    })

    afterEach(() => {
      global.FileReader = originalFileReader
    })

    it('loads a picked file as text and shows its name/size', async () => {
      const spec = { src: { kind: 'file', label: 'source' } }
      const onChange = vi.fn()
      const { container } = render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
      const file = new File(['hello world'], 'greeting.txt', { type: 'text/plain' })
      const input = container.querySelector('input[type="file"]')
      fireEvent.change(input, { target: { files: [file] } })
      await waitFor(() => expect(onChange).toHaveBeenCalledWith({ src: 'hello world' }))
      expect(readAsTextSpy).toHaveBeenCalledTimes(1)
      expect(screen.getByText(/greeting\.txt/)).toBeTruthy()
    })

    it('loads a picked file as base64 when spec.as is "base64"', async () => {
      const spec = { src: { kind: 'file', label: 'source', as: 'base64' } }
      const onChange = vi.fn()
      const { container } = render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
      const file = new File(['hi'], 'x.bin', { type: 'application/octet-stream' })
      const input = container.querySelector('input[type="file"]')
      fireEvent.change(input, { target: { files: [file] } })
      await waitFor(() => expect(onChange).toHaveBeenCalledWith({ src: Buffer.from('hi').toString('base64') }))
      expect(readAsDataURLSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('color: keeps the swatch synced with a valid hex and falls back for non-hex text', () => {
    const spec = { accent: { kind: 'color', label: 'accent', default: '#ff0000' } }
    const onChange = vi.fn()
    const { container, rerender } = render(<ParamsEditor spec={spec} params={{ accent: '#00ff00' }} onChange={onChange} />)
    expect(container.querySelector('input[type="color"]').value).toBe('#00ff00')

    rerender(<ParamsEditor spec={spec} params={{ accent: 'not-a-color' }} onChange={onChange} />)
    expect(container.querySelector('input[type="color"]').value).toBe('#ff0000')

    fireEvent.change(screen.getByLabelText('accent'), { target: { value: '#123456' } })
    expect(onChange).toHaveBeenCalledWith({ accent: '#123456' })
  })

  it('date: uses type=date by default and datetime-local when spec.withTime is set', () => {
    const spec = { when: { kind: 'date', label: 'when' } }
    const onChange = vi.fn()
    const { rerender } = render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    expect(screen.getByLabelText('when')).toHaveAttribute('type', 'date')

    rerender(<ParamsEditor spec={{ when: { ...spec.when, withTime: true } }} params={{}} onChange={onChange} />)
    expect(screen.getByLabelText('when')).toHaveAttribute('type', 'datetime-local')

    fireEvent.change(screen.getByLabelText('when'), { target: { value: '2024-01-01T00:00' } })
    expect(onChange).toHaveBeenCalledWith({ when: '2024-01-01T00:00' })
  })

  describe('multiselect', () => {
    const spec = { tags: { kind: 'multiselect', label: 'tags', options: ['a', 'b', 'c'] } }

    it('renders as an accessible checkbox group and adds a selection', () => {
      const onChange = vi.fn()
      render(<ParamsEditor spec={spec} params={{ tags: ['a'] }} onChange={onChange} />)
      expect(screen.getByRole('group', { name: 'tags' })).toBeTruthy()
      fireEvent.click(screen.getByRole('checkbox', { name: 'b' }))
      expect(onChange).toHaveBeenCalledWith({ tags: ['a', 'b'] })
    })

    it('tolerates a legacy single-string value', () => {
      render(<ParamsEditor spec={spec} params={{ tags: 'a' }} onChange={() => {}} />)
      expect(screen.getByRole('checkbox', { name: 'a' }).checked).toBe(true)
      expect(screen.getByRole('checkbox', { name: 'b' }).checked).toBe(false)
    })
  })

  it('range: renders a slider with a numeric readout and aria-valuetext', () => {
    const spec = { level: { kind: 'range', label: 'level', min: 0, max: 10, step: 1, default: 5 } }
    const onChange = vi.fn()
    render(<ParamsEditor spec={spec} params={{}} onChange={onChange} />)
    const slider = screen.getByRole('slider')
    expect(slider).toHaveAttribute('aria-valuetext', '5')
    fireEvent.change(slider, { target: { value: '7' } })
    expect(onChange).toHaveBeenCalledWith({ level: 7 })
  })

  it('applies the idPrefix to control ids', () => {
    const spec = { x: { kind: 'string', label: 'x' } }
    render(<ParamsEditor spec={spec} params={{}} onChange={() => {}} idPrefix="step-1" />)
    expect(screen.getByLabelText('x')).toHaveAttribute('id', 'step-1-x')
  })

  it('keeps ids unique when several editors render without an idPrefix', () => {
    const spec = { pattern: { kind: 'string', label: 'pattern' } }
    render(
      <>
        <ParamsEditor spec={spec} params={{ pattern: 'one' }} onChange={() => {}} />
        <ParamsEditor spec={spec} params={{ pattern: 'two' }} onChange={() => {}} />
      </>
    )
    const [a, b] = screen.getAllByLabelText('pattern')
    expect(a).toHaveValue('one')
    expect(b).toHaveValue('two')
    expect(a.id).not.toBe(b.id)
  })

  it('links the description as help text via aria-describedby, alongside any error', () => {
    const spec = { n: { kind: 'number', label: 'n', min: 1, description: 'how many' } }
    render(<ParamsEditor spec={spec} params={{ n: 0 }} onChange={() => {}} idPrefix="s" />)
    const input = screen.getByLabelText('n')
    expect(input).toHaveAccessibleDescription(/how many/)
    expect(input).toHaveAccessibleDescription(/must be at least 1/)
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('tolerates missing params', () => {
    const spec = { s: { kind: 'string', label: 's', default: 'x' } }
    render(<ParamsEditor spec={spec} params={undefined} onChange={() => {}} />)
    expect(screen.getByLabelText('s')).toHaveValue('x')
  })

  describe('validation messages', () => {
    it('min', () => {
      render(<ParamsEditor spec={{ n: { kind: 'number', label: 'n', min: 3 } }} params={{ n: 1 }} onChange={() => {}} />)
      expect(screen.getByRole('alert')).toHaveTextContent('must be at least 3')
    })

    it('regex: the engine message, aria-invalid, and no match count while invalid', () => {
      const spec = { re: { kind: 'regex', label: 're' } }
      render(<ParamsEditor spec={spec} params={{ re: '(' }} onChange={() => {}} sampleInput="abc" />)
      expect(screen.getByLabelText('re')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('alert').textContent).toMatch(/unterminated group|invalid/i)
      expect(screen.queryByText(/in sample/)).toBeNull()
    })

    it('regex: the message does not echo the pattern, so the alert stays put while typing', () => {
      const spec = { re: { kind: 'regex', label: 're' } }
      const { rerender } = render(<ParamsEditor spec={spec} params={{ re: '(ab/: c' }} onChange={() => {}} />)
      const first = screen.getByRole('alert').textContent
      expect(first).toMatch(/unterminated group/i)
      expect(first).not.toContain('ab/')
      rerender(<ParamsEditor spec={spec} params={{ re: '(ab/: cd' }} onChange={() => {}} />)
      expect(screen.getByRole('alert').textContent).toBe(first)
    })

    it('regex: invalid flags from the sibling param are reported', () => {
      const spec = {
        re: { kind: 'regex', label: 're', flagsParam: 'flags' },
        flags: { kind: 'string', label: 'flags' },
      }
      render(<ParamsEditor spec={spec} params={{ re: 'a', flags: 'qq' }} onChange={() => {}} />)
      expect(screen.getByLabelText('re')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('alert').textContent).toMatch(/flag/i)
    })

    it('multiselect: unknown options', () => {
      const spec = { t: { kind: 'multiselect', label: 't', options: ['a', 'b'] } }
      render(<ParamsEditor spec={spec} params={{ t: ['a', 'zz'] }} onChange={() => {}} />)
      expect(screen.getByRole('alert')).toHaveTextContent('unknown option: zz')
      expect(screen.getByRole('group', { name: 't' })).toHaveAccessibleDescription(/unknown option: zz/)
    })

    it('select: a value outside the options is flagged on the <select> itself', () => {
      const spec = { m: { kind: 'select', label: 'mode', options: ['a', 'b'] } }
      render(<ParamsEditor spec={spec} params={{ m: 'zz' }} onChange={() => {}} idPrefix="q" />)
      const select = screen.getByLabelText('mode')
      expect(select.tagName).toBe('SELECT')
      expect(select).toHaveAttribute('id', 'q-m')
      expect(select).toHaveAttribute('aria-invalid', 'true')
      expect(select).toHaveAccessibleDescription(/must be one of: a, b/)
    })

    it('range: out-of-range values mark the slider invalid', () => {
      const spec = { r: { kind: 'range', label: 'r', min: 0, max: 1, step: 0.1 } }
      render(<ParamsEditor spec={spec} params={{ r: 5 }} onChange={() => {}} />)
      expect(screen.getByRole('slider')).toHaveAttribute('aria-invalid', 'true')
      expect(screen.getByRole('slider')).toHaveAccessibleDescription(/at most 1/)
    })
  })

  describe('untrusted / legacy values (share links, old localStorage)', () => {
    it('keyvalue: malformed entries render (and are normalised on the next edit) instead of crashing', () => {
      const spec = { rules: { kind: 'keyvalue', label: 'rules', keyLabel: 'find', valueLabel: 'replace' } }
      const onChange = vi.fn()
      render(<ParamsEditor spec={spec} params={{ rules: [5, null, ['a'], ['b', 'c', 'extra'], [{ x: 1 }, 7]] }} onChange={onChange} />)
      expect(screen.getByLabelText('find 1')).toHaveValue('a')
      expect(screen.getByLabelText('replace 1')).toHaveValue('')
      expect(screen.getByLabelText('replace 2')).toHaveValue('c')
      expect(screen.getByLabelText('replace 3')).toHaveValue('7')
      fireEvent.click(screen.getByRole('button', { name: /add row/i }))
      expect(onChange).toHaveBeenCalledWith({ rules: [['a', ''], ['b', 'c'], ['{"x":1}', '7'], ['', '']] })
    })

    it('text kinds show non-string values as text', () => {
      const spec = { src: { kind: 'code', label: 'source' }, body: { kind: 'textarea', label: 'body' }, s: { kind: 'string', label: 's' } }
      render(<ParamsEditor spec={spec} params={{ src: 42, body: { a: 1 }, s: null }} onChange={() => {}} />)
      expect(screen.getByLabelText('source')).toHaveValue('42')
      expect(screen.getByLabelText('body')).toHaveValue('{"a":1}')
      expect(screen.getByLabelText('s')).toHaveValue('')
    })

    it('keyvalue: a legacy string (which the utility still accepts) gets the note, not a validation error', () => {
      const spec = { rules: { kind: 'keyvalue', label: 'rules' } }
      render(<ParamsEditor spec={spec} params={{ rules: 'colour => color' }} onChange={() => {}} />)
      expect(screen.getByText(/legacy value/)).toBeTruthy()
      expect(screen.queryByRole('alert')).toBeNull()
      expect(screen.getByRole('group', { name: 'rules' })).not.toHaveAttribute('aria-describedby')
    })

    it('keyvalue: an empty string for a required list is still flagged', () => {
      const spec = { rules: { kind: 'keyvalue', label: 'rules', required: true } }
      render(<ParamsEditor spec={spec} params={{ rules: '' }} onChange={() => {}} />)
      expect(screen.getByRole('alert')).toHaveTextContent('required')
    })

    it('keyvalue: an empty legacy string is just an empty list, not a legacy note', () => {
      const spec = { rules: { kind: 'keyvalue', label: 'rules' } }
      render(<ParamsEditor spec={spec} params={{ rules: '' }} onChange={() => {}} />)
      expect(screen.queryByText(/legacy value/)).toBeNull()
      expect(screen.getByRole('button', { name: /add row/i })).toBeTruthy()
    })

    it('keyvalue: the conversion resolves escapes in keys only while the sibling regex flag is off', () => {
      const spec = {
        rules: { kind: 'keyvalue', label: 'rules' },
        regex: { kind: 'boolean', label: 'regex', default: false },
      }
      const onChange = vi.fn()
      const text = 'a\\.b => \\n\n\\# => x'
      const { rerender } = render(<ParamsEditor spec={spec} params={{ rules: text }} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: /convert to pairs/i }))
      expect(onChange).toHaveBeenLastCalledWith({ rules: [['a\\.b', '\n'], ['#', 'x']] })

      rerender(<ParamsEditor spec={spec} params={{ rules: text, regex: true }} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: /convert to pairs/i }))
      expect(onChange).toHaveBeenLastCalledWith({ rules: [['a\\.b', '\n'], ['\\#', 'x']], regex: true })
    })

    it('keyvalue: a value holding a line break is shown intact and survives editing it', () => {
      const spec = { rules: { kind: 'keyvalue', label: 'rules', keyLabel: 'find', valueLabel: 'replace' } }
      const onChange = vi.fn()
      render(<ParamsEditor spec={spec} params={{ rules: [[',', '\n'], ['a\r\nb', 'x']] }} onChange={onChange} />)
      const cell = screen.getByLabelText('replace 1')
      expect(cell).toHaveValue('\n')
      fireEvent.change(cell, { target: { value: '\n\n' } })
      expect(onChange).toHaveBeenLastCalledWith({ rules: [[',', '\n\n'], ['a\r\nb', 'x']] })
      expect(screen.getByLabelText('find 2').value).toMatch(/^a\r?\nb$/)
    })

    it('keyvalue: a plain Enter does not slip an invisible newline into a cell; Shift+Enter does', () => {
      const spec = { rules: { kind: 'keyvalue', label: 'rules', keyLabel: 'find' } }
      render(<ParamsEditor spec={spec} params={{ rules: [['a', 'b']] }} onChange={() => {}} />)
      const cell = screen.getByLabelText('find 1')
      expect(fireEvent.keyDown(cell, { key: 'Enter' })).toBe(false)
      expect(fireEvent.keyDown(cell, { key: 'Enter', shiftKey: true })).toBe(true)
    })

    it('keyvalue: the conversion skips # comments and splits on whichever separator comes first', () => {
      const spec = { rules: { kind: 'keyvalue', label: 'rules' } }
      const onChange = vi.fn()
      render(<ParamsEditor spec={spec} params={{ rules: '# header\na\tb => c\nx => y' }} onChange={onChange} />)
      fireEvent.click(screen.getByRole('button', { name: /convert to pairs/i }))
      expect(onChange).toHaveBeenCalledWith({ rules: [['a', 'b => c'], ['x', 'y']] })
    })

    it('number: a cleared box shows the default the runner will fall back to', () => {
      render(<ParamsEditor spec={{ n: { kind: 'number', label: 'n', default: 2 } }} params={{ n: '' }} onChange={() => {}} />)
      expect(screen.getByLabelText('n')).toHaveValue(null)
      expect(screen.getByLabelText('n')).toHaveAttribute('placeholder', '2')
    })

    it('number: an absent value with no default shows blank, not a fake 0', () => {
      render(<ParamsEditor spec={{ n: { kind: 'number', label: 'n' } }} params={{}} onChange={() => {}} />)
      expect(screen.getByLabelText('n')).toHaveValue(null)
    })

    it('range: a numeric string is shown as its number; an absent value without default starts at min', () => {
      const spec = { r: { kind: 'range', label: 'r', min: 2, max: 9 } }
      const { rerender } = render(<ParamsEditor spec={spec} params={{ r: '7' }} onChange={() => {}} />)
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '7')
      rerender(<ParamsEditor spec={spec} params={{}} onChange={() => {}} />)
      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '2')
      expect(screen.getByRole('slider')).toHaveValue('2')
    })

    it('date: ISO date-times are trimmed to what the native input can display', () => {
      const spec = { d: { kind: 'date', label: 'd' }, t: { kind: 'date', label: 't', withTime: true } }
      render(<ParamsEditor spec={spec} params={{ d: '2024-03-05T10:20:30Z', t: '2024-03-05' }} onChange={() => {}} />)
      expect(screen.getByLabelText('d')).toHaveValue('2024-03-05')
      expect(screen.getByLabelText('t')).toHaveValue('2024-03-05T00:00')
    })
  })

  describe('keyvalue UX', () => {
    const spec = { rules: { kind: 'keyvalue', label: 'rules', keyLabel: 'find', valueLabel: 'replace' } }

    it('has a visible label that names the group', () => {
      render(<ParamsEditor spec={spec} params={{ rules: [] }} onChange={() => {}} />)
      expect(screen.getByText('rules')).toBeVisible()
      expect(screen.getByRole('group', { name: 'rules' })).toBeTruthy()
    })

    it('keeps keyboard focus on the moved row', () => {
      render(<Stateful spec={spec} initial={{ rules: [['a', '1'], ['b', '2'], ['c', '3']] }} />)
      const down = screen.getByRole('button', { name: 'move row 1 down' })
      down.focus()
      fireEvent.click(down)
      expect(screen.getByLabelText('find 2')).toHaveValue('a')
      expect(screen.getByRole('button', { name: 'move row 2 down' })).toHaveFocus()
      fireEvent.click(screen.getByRole('button', { name: 'move row 2 down' }))
      expect(screen.getByLabelText('find 3')).toHaveValue('a')
      // the last row cannot move down any further, so focus lands on its "up" button
      expect(screen.getByRole('button', { name: 'move row 3 up' })).toHaveFocus()
    })

    it('puts focus in the new row after "add row"', () => {
      render(<Stateful spec={spec} initial={{ rules: [['a', '1']] }} />)
      const add = screen.getByRole('button', { name: /add row/i })
      add.focus()
      fireEvent.click(add)
      expect(screen.getByLabelText('find 2')).toHaveFocus()
    })

    it('moves focus to a neighbouring control after removing a row', () => {
      render(<Stateful spec={spec} initial={{ rules: [['a', '1'], ['b', '2']] }} />)
      const remove = screen.getByRole('button', { name: 'remove row 2' })
      remove.focus()
      fireEvent.click(remove)
      expect(screen.getByRole('button', { name: 'remove row 1' })).toHaveFocus()
      fireEvent.click(screen.getByRole('button', { name: 'remove row 1' }))
      expect(screen.getByRole('button', { name: /add row/i })).toHaveFocus()
    })
  })

  it('multiselect: emits selections in option order', () => {
    const spec = { t: { kind: 'multiselect', label: 't', options: ['a', 'b', 'c'] } }
    const onChange = vi.fn()
    render(<ParamsEditor spec={spec} params={{ t: ['c'] }} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: 'a' }))
    expect(onChange).toHaveBeenCalledWith({ t: ['a', 'c'] })
  })

  describe('color', () => {
    it('shows the spec placeholder (e.g. "blank = read from input")', () => {
      const spec = { fg: { kind: 'color', label: 'fg', default: '', placeholder: 'blank = read from input' } }
      render(<ParamsEditor spec={spec} params={{}} onChange={() => {}} />)
      expect(screen.getByLabelText('fg')).toHaveAttribute('placeholder', 'blank = read from input')
    })

    it('the swatch emits hex and keeps an existing alpha channel', () => {
      const spec = { c: { kind: 'color', label: 'c' } }
      const onChange = vi.fn()
      const { container, rerender } = render(<ParamsEditor spec={spec} params={{ c: '#11223380' }} onChange={onChange} />)
      const swatch = container.querySelector('input[type="color"]')
      expect(swatch).toHaveValue('#112233')
      fireEvent.change(swatch, { target: { value: '#aabbcc' } })
      expect(onChange).toHaveBeenLastCalledWith({ c: '#aabbcc80' })

      rerender(<ParamsEditor spec={spec} params={{ c: '#abc' }} onChange={onChange} />)
      expect(swatch).toHaveValue('#aabbcc')
      fireEvent.change(swatch, { target: { value: '#010203' } })
      expect(onChange).toHaveBeenLastCalledWith({ c: '#010203' })
    })
  })

  it('code: the fallback textarea is labelled and carries the error wiring', () => {
    const spec = { src: { kind: 'code', label: 'source', required: true } }
    render(<ParamsEditor spec={spec} params={{ src: '' }} onChange={() => {}} idPrefix="k" />)
    const textarea = screen.getByLabelText('source')
    expect(textarea).toHaveAttribute('id', 'k-src')
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
    expect(textarea).toHaveAccessibleDescription('required')
  })
})
