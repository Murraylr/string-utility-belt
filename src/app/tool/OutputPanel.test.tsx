import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ToolProvider, useTool } from '@/app/ToolContext'
import * as downloadModule from '@/app/io/download'
import OutputPanel from './OutputPanel'

vi.mock('@uiw/react-codemirror', () => ({
  default: (props: any) => <div data-testid="mock-codemirror">{props.value}</div>,
}))
vi.mock('@codemirror/lang-json', () => ({ json: () => null }))
vi.mock('@codemirror/lang-xml', () => ({ xml: () => null }))
vi.mock('@codemirror/lang-html', () => ({ html: () => null }))
vi.mock('@codemirror/lang-sql', () => ({ sql: () => null }))
vi.mock('@codemirror/lang-yaml', () => ({ yaml: () => null }))
vi.mock('@codemirror/lang-markdown', () => ({ markdown: () => null }))

function InputProbe() {
  const { input } = useTool()
  return <div data-testid="input-probe">{String(input)}</div>
}

function Harness({ initialInput = 'hello' }: { initialInput?: string }) {
  return (
    <ToolProvider initialSteps={[]} initialInput={initialInput} persist={false}>
      <OutputPanel />
    </ToolProvider>
  )
}

afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('OutputPanel', () => {
  it('shows the pipeline output and a stats readout', async () => {
    render(<Harness initialInput="hello world" />)
    expect(await screen.findByTestId('stats-bar')).toHaveTextContent('2 words')
  })

  it('downloads with a smart filename/MIME derived from the output', () => {
    const spy = vi.spyOn(downloadModule, 'triggerDownload').mockImplementation(() => {})
    render(<Harness initialInput="just some words" />)
    fireEvent.click(screen.getByRole('button', { name: /download/i }))
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toMatchObject({ filename: 'result.txt', mime: 'text/plain;charset=utf-8' })
  })

  it('offers copy and copy-as via CopyAsMenu', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'copy as…' })).toBeTruthy()
  })

  it('does not make the whole result an aria-live region (it would re-read megabytes on every keystroke)', async () => {
    render(<Harness initialInput="hello" />)
    const region = await screen.findByRole('region', { name: 'Result' })
    expect(region.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull()
    expect(region.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull()
  })

  it('names the result region for assistive tech', async () => {
    render(<Harness initialInput="hello" />)
    expect(await screen.findByRole('region', { name: 'Result' })).toHaveTextContent('hello')
  })

  it('flags a result computed from only a prefix of a large input, so copy/download are not mistaken for the full result', async () => {
    localStorage.setItem('sub:pref:previewLimit', 'true')
    render(<Harness initialInput={'a'.repeat(1_000_001)} />)
    expect(await screen.findByText(/first 64 KB only/i)).toBeTruthy()
  })

  it('does not flag an ordinary result as partial', async () => {
    render(<Harness initialInput="hello" />)
    await screen.findByRole('region', { name: 'Result' })
    await new Promise(r => setTimeout(r, 50))
    expect(screen.queryByText(/first 64 KB only/i)).toBeNull()
  })

  it('reports failed steps rather than a timing', async () => {
    render(
      <ToolProvider initialSteps={[{ id: 's1', utilityId: 'json_minify', params: {}, enabled: true } as never]} initialInput="not json" persist={false}>
        <OutputPanel />
      </ToolProvider>,
    )
    expect(await screen.findByText('1 step failed')).toBeTruthy()
    expect(screen.queryByText(/ ms$/)).toBeNull()
  })

  it('replaces the input with the output on "Use as input"', async () => {
    render(
      <ToolProvider initialSteps={[{ id: 's1', utilityId: 'case', params: { mode: 'upper' }, enabled: true } as never]} initialInput="abc" persist={false}>
        <OutputPanel />
        <InputProbe />
      </ToolProvider>,
    )
    const use = screen.getByRole('button', { name: 'Use as input' })
    await waitFor(() => expect(use).toBeEnabled())
    fireEvent.click(use)
    await waitFor(() => expect(screen.getByTestId('input-probe').textContent).toBe('ABC'))
  })

  it('downloads a bytes result as raw bytes with a sniffed extension', () => {
    const spy = vi.spyOn(downloadModule, 'triggerDownload').mockImplementation(() => {})
    render(
      <ToolProvider initialSteps={[]} initialInput={new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])} persist={false} initialName="My Report">
        <OutputPanel />
      </ToolProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: /download/i }))
    expect(spy.mock.calls[0][0]).toMatchObject({ filename: 'my-report.pdf', mime: 'application/pdf' })
    expect(Array.from(spy.mock.calls[0][0].data as Uint8Array)).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d])
  })
})
