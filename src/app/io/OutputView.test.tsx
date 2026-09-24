import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import * as detect from './detectKind'
import OutputView from './OutputView'

const cmProps = vi.hoisted(() => ({ last: null as any }))
vi.mock('@uiw/react-codemirror', () => ({
  default: (props: any) => {
    cmProps.last = props
    return <div data-testid="mock-codemirror" data-theme={props.theme}>{props.value}</div>
  },
  EditorView: { contentAttributes: { of: (attrs: Record<string, string>) => ({ contentAttributes: attrs }) } },
}))
vi.mock('@codemirror/lang-json', () => ({ json: () => 'json-ext' }))
vi.mock('@codemirror/lang-xml', () => ({ xml: () => 'xml-ext' }))
vi.mock('@codemirror/lang-html', () => ({ html: () => 'html-ext' }))
vi.mock('@codemirror/lang-sql', () => ({ sql: () => { throw new Error('extension failed to load') } }))
vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => 'yaml-ext' }))
vi.mock('@codemirror/lang-markdown', () => ({ markdown: () => 'md-ext' }))

async function flushMicrotasks() {
  await new Promise(r => setTimeout(r, 0))
  await new Promise(r => setTimeout(r, 0))
}

describe('OutputView (bytes)', () => {
  it('shows a lossy text view by default with a text/hex toggle', () => {
    render(<OutputView value={new Uint8Array([72, 105])} text="Hi" />)
    expect(screen.getByText('Hi')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'text' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'hex' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('opens binary-looking bytes in the hex view, and text-like bytes as text', () => {
    const { unmount } = render(<OutputView value={new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff])} text="" />)
    expect(screen.getByRole('button', { name: 'hex' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('table', { name: /hex view/i })).toBeTruthy()
    unmount()
    render(<OutputView value={new TextEncoder().encode('plain words')} text="" />)
    expect(screen.getByRole('button', { name: 'text' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('plain words')).toBeTruthy()
  })

  it('renders at most the first 1 MB of a large bytes value as text, and says so', () => {
    const bytes = new Uint8Array(1024 * 1024 + 500).fill(0x61)
    render(<OutputView value={bytes} text="" />)
    const pre = document.querySelector('pre') as HTMLElement
    expect(pre.textContent!.length).toBe(1024 * 1024)
    expect(screen.getByText(/first 1 MB/i)).toBeTruthy()
  })

  it('switches to a hex dump on toggle', async () => {
    const user = userEvent.setup()
    render(<OutputView value={new Uint8Array([0x41])} text="A" />)
    await user.click(screen.getByRole('button', { name: 'hex' }))
    expect(screen.getByRole('table', { name: /hex view/i })).toBeTruthy()
  })
})

describe('OutputView (text/json highlighting)', () => {
  it('shows a <pre> first, then swaps in the lazily-loaded CodeMirror', async () => {
    render(<OutputView value={{ a: 1 }} text={'{\n  "a": 1\n}'} />)
    expect(screen.getByText(/"a": 1/).tagName).toBe('PRE')
    const cm = await screen.findByTestId('mock-codemirror')
    expect(cm.textContent).toContain('"a": 1')
  })

  it('picks the light/dark CodeMirror theme from <html class="dark">', async () => {
    document.documentElement.classList.add('dark')
    render(<OutputView value='{"a":1}' text='{"a":1}' />)
    const cm = await screen.findByTestId('mock-codemirror')
    expect(cm.getAttribute('data-theme')).toBe('dark')
    document.documentElement.classList.remove('dark')
  })

  it('skips CodeMirror entirely for plain, undetected text', async () => {
    render(<OutputView value="just some words" text="just some words" />)
    await flushMicrotasks()
    expect(screen.getByText('just some words').tagName).toBe('PRE')
    expect(screen.queryByTestId('mock-codemirror')).toBeNull()
  })

  it('stays on <pre> for outputs over the ~1 MB highlight cap', async () => {
    const big = 'x'.repeat(1024 * 1024 + 1)
    render(<OutputView value={big} text={big} />)
    await flushMicrotasks()
    expect(screen.queryByTestId('mock-codemirror')).toBeNull()
  })

  it('falls back to <pre> when a language extension fails to load', async () => {
    render(<OutputView value="SELECT 1" text="SELECT 1" />)
    await waitFor(async () => {
      await flushMicrotasks()
      expect(screen.queryByTestId('mock-codemirror')).toBeNull()
    })
    expect(screen.getByText('SELECT 1').tagName).toBe('PRE')
  })

  it('skips kind detection entirely for outputs over the cap (no JSON.parse of megabytes per run)', async () => {
    const spy = vi.spyOn(detect, 'detectKind')
    const big = `[${'1,'.repeat(600 * 1024)}1]`
    render(<OutputView value={big} text={big} />)
    await flushMicrotasks()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('keeps the CodeMirror extensions/basicSetup props stable across re-renders (each change reconfigures the editor)', async () => {
    const { rerender } = render(<OutputView value={{ a: 1 }} text={'{\n  "a": 1\n}'} />)
    await screen.findByTestId('mock-codemirror')
    const { extensions, basicSetup } = cmProps.last
    rerender(<OutputView value={{ a: 1 }} text={'{\n  "a": 1\n}'} />)
    rerender(<OutputView value={{ a: 2 }} text={'{\n  "a": 2\n}'} />)
    await screen.findByText(/"a": 2/)
    expect(cmProps.last.extensions).toBe(extensions)
    expect(cmProps.last.basicSetup).toBe(basicSetup)
  })

  it('gives the highlighted editor an accessible name', async () => {
    render(<OutputView value={{ a: 1 }} text={'{\n  "a": 1\n}'} label="result" />)
    await screen.findByTestId('mock-codemirror')
    expect(cmProps.last.extensions).toContainEqual({ contentAttributes: { 'aria-label': 'result' } })
    expect(cmProps.last.extensions).toContain('json-ext')
  })

  it('renders highlighted output read-only but still focusable for keyboard selection', async () => {
    render(<OutputView value={{ a: 1 }} text={'{\n  "a": 1\n}'} />)
    await screen.findByTestId('mock-codemirror')
    expect(cmProps.last.readOnly).toBe(true)
    expect(cmProps.last.editable).not.toBe(false)
  })
})

describe('OutputView (narrow layouts)', () => {
  it('lets an unbroken token wrap anywhere, so it cannot widen the page on mobile', () => {
    // `break-words` (overflow-wrap: break-word) doesn't lower min-content width, so a long
    // base64/hash token inside the IO grid pushed the whole page ~40px past a 375px viewport.
    const token = 'aGVsbG8gd29ybGQKc2Vjb25kIGxpbmU='.repeat(4)
    render(<OutputView value={token} text={token} />)
    const pre = screen.getByText(token)
    expect(pre.tagName).toBe('PRE')
    expect(pre).toHaveClass('[overflow-wrap:anywhere]')
    expect(pre).not.toHaveClass('break-words')
  })
})
