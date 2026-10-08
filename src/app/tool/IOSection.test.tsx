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

vi.mock('@/app/sponsors/ToolPromo', () => ({ default: () => <div data-testid="tool-promo" /> }))

function Harness({ initialInput = 'hello' }: { initialInput?: Value }) {
  return (
    <ToolProvider initialSteps={[]} initialInput={initialInput} persist={false}>
      <IOSection header={<h1>title</h1>}><div data-testid="steps" /></IOSection>
    </ToolProvider>
  )
}

const toBelow = () => screen.getByRole('button', { name: 'Show the output below the steps' })
const toBeside = () => screen.getByRole('button', { name: 'Show the output beside the steps' })

afterEach(() => localStorage.clear())

describe('IOSection layout', () => {
  it('puts the title, input and steps in the main column, in that order', () => {
    render(<Harness />)
    const heading = screen.getByRole('heading', { name: 'title' })
    const input = screen.getByPlaceholderText(/type or paste/i)
    const steps = screen.getByTestId('steps')
    expect(heading.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(input.compareDocumentPosition(steps) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('defaults to the output beside the steps, and switches it below', () => {
    render(<Harness />)
    fireEvent.click(toBelow())
    expect(toBeside()).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('sub:pref:ioLayout') as string)).toBe('stacked')
    fireEvent.click(toBeside())
    expect(JSON.parse(localStorage.getItem('sub:pref:ioLayout') as string)).toBe('side-by-side')
  })

  it('keeps an earlier "stacked" choice', () => {
    localStorage.setItem('sub:pref:ioLayout', JSON.stringify('stacked'))
    render(<Harness />)
    expect(toBeside()).toBeTruthy()
  })

  it('shows our own tool under the output, after its actions', () => {
    render(<Harness />)
    const promo = screen.getByTestId('tool-promo')
    const download = screen.getByRole('button', { name: /download/i })
    expect(download.compareDocumentPosition(promo) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('shows the input->output diff when Diff is picked, and the result again on Result', async () => {
    render(<Harness initialInput="hello" />)
    fireEvent.click(screen.getByRole('button', { name: 'Diff' }))
    expect(await screen.findByLabelText('input to output diff')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Result' })).toBeNull()
    expect(JSON.parse(localStorage.getItem('sub:pref:ioDiff') as string)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Result' }))
    expect(screen.getByRole('region', { name: 'Result' })).toBeTruthy()
  })

  it('keeps the panels mounted (and their state) when switching layout', async () => {
    render(<Harness initialInput="" />)
    const area = screen.getByPlaceholderText(/type or paste/i)
    fireEvent.drop(area.parentElement as HTMLElement, {
      dataTransfer: { files: [new File([new Uint8Array([0xff, 0xfe])], 'kept.bin', { type: 'application/octet-stream' })] },
    })
    await screen.findByText('kept.bin')
    fireEvent.click(toBelow())
    expect(screen.getByText('kept.bin')).toBeTruthy()
  })

  it('diffs the output as text (pretty JSON), not as the bytes/debug display form', async () => {
    localStorage.setItem('sub:pref:ioDiff', JSON.stringify(true))
    render(<Harness initialInput="same text" />)
    const region = await screen.findByLabelText('input to output diff')
    expect(region.textContent).toContain('same text')
  })

  it('diffs json values as pretty JSON and bytes as decoded text', async () => {
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
