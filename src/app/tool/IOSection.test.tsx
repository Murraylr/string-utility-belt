import { render, screen, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolProvider } from '@/app/ToolContext'
import type { Value } from '@/types/utility'
import IOSection from './IOSection'

vi.mock('@uiw/react-codemirror', () => ({
  default: (props: any) => <div data-testid="mock-codemirror">{props.value}</div>,
}))
vi.mock('@codemirror/lang-json', () => ({ json: () => null }))
vi.mock('@codemirror/lang-xml', () => ({ xml: () => null }))
vi.mock('@codemirror/lang-html', () => ({ html: () => null }))
vi.mock('@codemirror/lang-sql', () => ({ sql: () => null }))
vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => null }))
vi.mock('@codemirror/lang-markdown', () => ({ markdown: () => null }))
// keeps the diff-toggle wiring test fast/deterministic rather than depending on a cold
// dynamic import of the real 'diff' package resolving inside findByLabelText's timeout
vi.mock('diff', () => ({
  diffLines: (a: string, b: string, opts: { callback: (r: unknown) => void }) => {
    const changes = a === b
      ? [{ value: a, added: false, removed: false, count: 1 }]
      : [{ value: a, added: false, removed: true, count: 1 }, { value: b, added: true, removed: false, count: 1 }]
    setTimeout(() => opts.callback(changes), 0)
  },
}))

function Harness({ initialInput = 'hello' }: { initialInput?: Value }) {
  return (
    <ToolProvider initialSteps={[]} initialInput={initialInput} persist={false}>
      <IOSection />
    </ToolProvider>
  )
}

afterEach(() => localStorage.clear())

describe('IOSection layout', () => {
  it('defaults to stacked, with no diff toggle', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /side-by-side/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByRole('button', { name: /^diff$/i })).toBeNull()
  })

  it('toggles to side-by-side and reveals the diff toggle', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /side-by-side/i }))
    expect(screen.getByRole('button', { name: /side-by-side/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^diff$/i })).toBeTruthy()
  })

  it('shows the input->output diff once enabled in side-by-side', async () => {
    render(<Harness initialInput="hello" />)
    fireEvent.click(screen.getByRole('button', { name: /side-by-side/i }))
    fireEvent.click(screen.getByRole('button', { name: /^diff$/i }))
    expect(await screen.findByLabelText('input to output diff')).toBeTruthy()
  })

  it('persists the layout choice as a preference', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: /side-by-side/i }))
    expect(JSON.parse(localStorage.getItem('sub:pref:ioLayout') as string)).toBe('side-by-side')
  })

  it('keeps the panels mounted (and their state) when switching layout', async () => {
    render(<Harness initialInput="" />)
    const area = screen.getByPlaceholderText(/type or paste/i)
    fireEvent.drop(area.parentElement as HTMLElement, {
      dataTransfer: { files: [new File([new Uint8Array([0xff, 0xfe])], 'kept.bin', { type: 'application/octet-stream' })] },
    })
    await screen.findByText('kept.bin')
    fireEvent.click(screen.getByRole('button', { name: /side-by-side/i }))
    expect(screen.getByText('kept.bin')).toBeTruthy()
  })

  it('diffs the output as text (pretty JSON), not as the bytes/debug display form', async () => {
    localStorage.setItem('sub:pref:ioLayout', JSON.stringify('side-by-side'))
    localStorage.setItem('sub:pref:ioDiff', JSON.stringify(true))
    render(<Harness initialInput="same text" />)
    const region = await screen.findByLabelText('input to output diff')
    expect(region.textContent).toContain('same text')
  })

  it('diffs json values as pretty JSON and bytes as decoded text', async () => {
    localStorage.setItem('sub:pref:ioLayout', JSON.stringify('side-by-side'))
    localStorage.setItem('sub:pref:ioDiff', JSON.stringify(true))
    const { unmount } = render(<Harness initialInput={{ a: 1 }} />)
    const json = await screen.findByLabelText('input to output diff')
    expect(json.textContent).toContain('"a": 1')
    expect(json.textContent).not.toContain('[object Object]')
    unmount()
    render(<Harness initialInput={new TextEncoder().encode('from bytes')} />)
    const bytes = await screen.findByLabelText('input to output diff')
    expect(bytes.textContent).toContain('from bytes')
    expect(bytes.textContent).not.toContain('bytes[')
  })
})
