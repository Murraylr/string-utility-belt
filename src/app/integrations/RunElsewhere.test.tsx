import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParamSpec } from '@/types/utility'
import RunElsewhere from './RunElsewhere'
import { MCP_ADD_COMMAND } from './snippets'

const PARAMS: Record<string, ParamSpec> = { width: { kind: 'number', label: 'x', default: 2, max: 10 } }
const META = { id: 'demo', params: PARAMS, env: [] }

const section = () => screen.getByRole('region', { name: 'Run it from your terminal or AI agent' })
// stands in for the app's link handler (or the browser): jsdom cannot follow a link
const holdNavigation = (e: MouseEvent) => e.preventDefault()

describe('RunElsewhere', () => {
  beforeEach(() => document.addEventListener('click', holdNavigation))
  afterEach(() => {
    document.removeEventListener('click', holdNavigation)
    vi.useRealTimers()
  })

  it('shows the CLI command, the MCP install and the run_utility arguments for the current run', () => {
    render(<RunElsewhere meta={META} input="hello" params={{ width: 4 }} />)
    const s = section()
    expect(within(s).getByText("npx subelt -t hello demo:width=4")).toBeTruthy()
    expect(within(s).getByText(MCP_ADD_COMMAND)).toBeTruthy()
    expect(within(s).getByText('{"id":"demo","params":{"width":4}}')).toBeTruthy()
  })

  it('follows the playground as it changes', () => {
    const { rerender } = render(<RunElsewhere meta={META} input="" params={{ width: 2 }} />)
    expect(within(section()).getByText('npx subelt -i input.txt demo')).toBeTruthy()
    rerender(<RunElsewhere meta={META} input="a b" params={{ width: 3 }} />)
    expect(within(section()).getByText("npx subelt -t 'a b' demo:width=3")).toBeTruthy()
  })

  it('renders nothing for a utility that needs a browser', () => {
    const { container } = render(<RunElsewhere meta={{ ...META, env: ['dom'] }} input="" params={{}} />)
    expect(container.innerHTML).toBe('')
  })

  it('links to the CLI and MCP install sections, reporting which was followed', () => {
    const onDocsClick = vi.fn()
    render(<RunElsewhere meta={META} input="" params={{}} onDocsClick={onDocsClick} />)
    const cli = within(section()).getByRole('link', { name: 'subelt command-line tool' })
    const mcp = within(section()).getByRole('link', { name: 'MCP server' })
    expect(cli.getAttribute('href')).toBe('/integrations/#command-line-tool')
    expect(mcp.getAttribute('href')).toBe('/integrations/#mcp-server-for-ai-agents')
    fireEvent.click(mcp)
    expect(onDocsClick).toHaveBeenCalledWith('mcp')
  })

  it('copies a command, confirms it briefly and reports which one', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const onCopy = vi.fn()
    render(<RunElsewhere meta={META} input="hi" params={{}} onCopy={onCopy} />)
    const [cliCopy] = within(section()).getAllByRole('button', { name: 'Copy' })
    await act(async () => { fireEvent.click(cliCopy) })
    expect(writeText).toHaveBeenCalledWith('npx subelt -t hi demo')
    expect(onCopy).toHaveBeenCalledWith('cli')
    expect(cliCopy.textContent).toBe('Copied')
    act(() => { vi.advanceTimersByTime(1500) })
    expect(cliCopy.textContent).toBe('Copy')
  })

  it('reports nothing when the clipboard refuses', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    const onCopy = vi.fn()
    render(<RunElsewhere meta={META} input="hi" params={{}} onCopy={onCopy} />)
    await act(async () => { fireEvent.click(within(section()).getAllByRole('button', { name: 'Copy' })[1]) })
    expect(onCopy).not.toHaveBeenCalled()
  })

  it('pre-renders without browser APIs, escaping what it shows', () => {
    const html = renderToStaticMarkup(<RunElsewhere meta={META} input="<b>" params={{}} />)
    expect(html).toContain('npx subelt -t &#x27;&lt;b&gt;&#x27; demo')
  })
})
