import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import FileParam, { MAX_FILE_BYTES } from './FileParam'
import ParamsEditor from '../ParamsEditor'
import { useState } from 'react'

/** A FileReader whose reads finish only when the test says so. */
class ManualReader {
  static instances = []
  result = null
  error = null
  onload = null
  onerror = null
  constructor() { ManualReader.instances.push(this) }
  readAsText(file) { this.file = file; this.mode = 'text' }
  readAsDataURL(file) { this.file = file; this.mode = 'dataurl' }
  succeed(result) { this.result = result; this.onload?.() }
  fail(message = 'boom') { this.error = new Error(message); this.onerror?.() }
}

const spec = (extra = {}) => ({ kind: 'file', label: 'other text', ...extra })
const fileInput = container => container.querySelector('input[type="file"]')

describe('FileParam', () => {
  let original
  beforeEach(() => {
    original = global.FileReader
    ManualReader.instances = []
    global.FileReader = ManualReader
  })
  afterEach(() => { global.FileReader = original })

  it('names the load button after the param and announces the loaded file politely', async () => {
    const onChange = vi.fn()
    const { container } = render(<FileParam id="f" spec={spec()} value="" onChange={onChange} />)
    expect(screen.getByRole('button', { name: /load file/i })).toHaveAccessibleName(/other text/)
    fireEvent.change(fileInput(container), { target: { files: [new File(['hi'], 'a.txt')] } })
    await act(async () => { ManualReader.instances[0].succeed('hi') })
    expect(onChange).toHaveBeenCalledWith('hi')
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('a.txt')
  })

  it('clears the picker so choosing the same file again reloads it', async () => {
    const onChange = vi.fn()
    const { container } = render(<FileParam id="f" spec={spec()} value="" onChange={onChange} />)
    const input = fileInput(container)
    fireEvent.change(input, { target: { files: [new File(['hi'], 'a.txt')] } })
    await act(async () => { ManualReader.instances[0].succeed('hi') })
    expect(input.value).toBe('')
  })

  it('shows a read failure instead of leaving an unhandled rejection', async () => {
    const onChange = vi.fn()
    const { container } = render(<FileParam id="f" spec={spec()} value="" onChange={onChange} />)
    fireEvent.change(fileInput(container), { target: { files: [new File(['hi'], 'broken.txt')] } })
    await act(async () => { ManualReader.instances[0].fail('disk on fire') })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(/could not read broken\.txt/i)
  })

  it('a slower, older read never overwrites a newer one', async () => {
    const onChange = vi.fn()
    const { container } = render(<FileParam id="f" spec={spec()} value="" onChange={onChange} />)
    fireEvent.change(fileInput(container), { target: { files: [new File(['old'], 'old.txt')] } })
    fireEvent.change(fileInput(container), { target: { files: [new File(['new'], 'new.txt')] } })
    const [older, newer] = ManualReader.instances
    await act(async () => { newer.succeed('new') })
    await act(async () => { older.succeed('old') })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('new')
    expect(screen.getByRole('status')).toHaveTextContent('new.txt')
  })

  it('refuses files over the size cap without reading them', async () => {
    const onChange = vi.fn()
    const { container } = render(<FileParam id="f" spec={spec()} value="" onChange={onChange} />)
    const big = new File(['x'], 'huge.bin')
    Object.defineProperty(big, 'size', { value: MAX_FILE_BYTES + 1 })
    fireEvent.change(fileInput(container), { target: { files: [big] } })
    await act(async () => {})
    expect(ManualReader.instances).toHaveLength(0)
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent(/too large/i)
  })

  it('base64: an empty file yields an empty string, not the bare "data:" prefix', async () => {
    const onChange = vi.fn()
    const { container } = render(<FileParam id="f" spec={spec({ as: 'base64' })} value="" onChange={onChange} />)
    fireEvent.change(fileInput(container), { target: { files: [new File([], 'empty.bin')] } })
    expect(ManualReader.instances[0].mode).toBe('dataurl')
    await act(async () => { ManualReader.instances[0].succeed('data:') })
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('loads a dropped file, but leaves plain-text drags to the textarea', async () => {
    const onChange = vi.fn()
    render(<FileParam id="f" spec={spec()} value="" onChange={onChange} />)
    const textarea = screen.getByRole('textbox')

    // dragging selected text: the browser's default drop (insert text) must not be cancelled
    const textDrag = { types: ['text/plain'], files: [] }
    expect(fireEvent.dragOver(textarea, { dataTransfer: textDrag })).toBe(true)
    expect(fireEvent.drop(textarea, { dataTransfer: textDrag })).toBe(true)

    const file = new File(['dropped'], 'd.txt')
    const fileDrag = { types: ['Files'], files: [file] }
    expect(fireEvent.dragOver(textarea, { dataTransfer: fileDrag })).toBe(false)
    expect(fireEvent.drop(textarea, { dataTransfer: fileDrag })).toBe(false)
    await act(async () => { ManualReader.instances[0].succeed('dropped') })
    expect(onChange).toHaveBeenCalledWith('dropped')
  })

  it('stops showing the file name once the content no longer comes from that file', async () => {
    const onChange = vi.fn()
    const { container, rerender } = render(<FileParam id="f" spec={spec()} value="" onChange={onChange} />)
    fireEvent.change(fileInput(container), { target: { files: [new File(['hi'], 'a.txt')] } })
    await act(async () => { ManualReader.instances[0].succeed('hi') })
    rerender(<FileParam id="f" spec={spec()} value="hi" onChange={onChange} />)
    expect(screen.getByRole('status')).toHaveTextContent('a.txt')
    rerender(<FileParam id="f" spec={spec()} value="hi, edited" onChange={onChange} />)
    expect(screen.getByRole('status')).not.toHaveTextContent('a.txt')
  })

  it('delivers the content through the latest onChange, so params edited during the read survive', async () => {
    const stale = vi.fn()
    const latest = vi.fn()
    const { container, rerender } = render(<FileParam id="f" spec={spec()} value="" onChange={stale} />)
    fireEvent.change(fileInput(container), { target: { files: [new File(['hi'], 'a.txt')] } })
    // another param changed while the file was being read: ParamsEditor hands down a new closure
    rerender(<FileParam id="f" spec={spec()} value="" onChange={latest} />)
    await act(async () => { ManualReader.instances[0].succeed('hi') })
    expect(stale).not.toHaveBeenCalled()
    expect(latest).toHaveBeenCalledWith('hi')
  })

  it('in ParamsEditor: toggling another param while a file loads keeps both changes', async () => {
    const seen = vi.fn()
    function Harness() {
      const [params, setParams] = useState({ other: '', flag: false })
      return (
        <ParamsEditor
          spec={{ other: { kind: 'file', label: 'other' }, flag: { kind: 'boolean', label: 'flag' } }}
          params={params}
          onChange={p => { setParams(p); seen(p) }}
        />
      )
    }
    const { container } = render(<Harness />)
    fireEvent.change(fileInput(container), { target: { files: [new File(['hi'], 'a.txt')] } })
    fireEvent.click(screen.getByLabelText('flag'))
    await act(async () => { ManualReader.instances[0].succeed('file body') })
    expect(seen).toHaveBeenLastCalledWith({ other: 'file body', flag: true })
  })

  it('does not call onChange after unmounting mid-read', async () => {
    const onChange = vi.fn()
    const { container, unmount } = render(<FileParam id="f" spec={spec()} value="" onChange={onChange} />)
    fireEvent.change(fileInput(container), { target: { files: [new File(['hi'], 'a.txt')] } })
    unmount()
    await act(async () => { ManualReader.instances[0].succeed('hi') })
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('FileParam with the real jsdom FileReader', () => {
  it('reads text and base64', async () => {
    const onChange = vi.fn()
    const { container, rerender } = render(<FileParam id="f" spec={spec()} value="" onChange={onChange} />)
    fireEvent.change(fileInput(container), { target: { files: [new File(['héllo ✓'], 'u.txt')] } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('héllo ✓'))

    rerender(<FileParam id="f" spec={spec({ as: 'base64' })} value="" onChange={onChange} />)
    fireEvent.change(fileInput(container), { target: { files: [new File([new Uint8Array([0, 255, 1])], 'b.bin')] } })
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('AP8B'))
  })
})
