import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ToolProvider, useTool } from '@/app/ToolContext'
import { registry } from '@/app/registry'
import type { Utility } from '@/types/utility'
import EmptyState from './EmptyState'

function Probe() {
  const { state, setInput } = useTool()
  return (
    <>
      <pre data-testid="steps">{JSON.stringify(state.steps.map(s => ('utilityId' in s ? [s.utilityId, s.params] : s.id)))}</pre>
      <button type="button" onClick={() => setInput('just some plain words')}>set plain input</button>
    </>
  )
}

const stepsShown = () => JSON.parse(screen.getByTestId('steps').textContent || '[]') as [string, unknown][]

function Harness({ initialInput }: { initialInput?: string }) {
  return (
    <ToolProvider initialSteps={[]} initialInput={initialInput} persist={false}>
      <Probe />
      <EmptyState />
    </ToolProvider>
  )
}

afterEach(() => {
  localStorage.removeItem('string-utility-belt')
})

describe('EmptyState', () => {
  it('asks for input when there is none', () => {
    render(<Harness initialInput="" />)
    expect(screen.getByRole('status')).toHaveTextContent('Paste something and we’ll suggest a pipeline.')
  })

  it('suggests a decoder for non-empty input and adds it (with default params) on click', async () => {
    render(<Harness initialInput={'{"a":1}'} />)
    expect(screen.queryByText('Paste something and we’ll suggest a pipeline.')).toBeNull()
    const suggestion = await screen.findByText('JSON pretty-print', {}, { timeout: 5000 })
    const button = screen.getByRole('button', { name: /^JSON pretty-print, \d+% confidence$/ })
    expect(button).toHaveAccessibleDescription(/"a": 1/)
    expect(stepsShown()).toEqual([])
    fireEvent.click(suggestion)
    await waitFor(() => expect(stepsShown()).toEqual([['json_pretty', { indent: 2 }]]))
  })

  it('shows at most three suggestions', async () => {
    // five formats that all "decode", so the cap — not the detector — decides the count
    const formats: [string, string][] = [
      ['base64', 'base64_decode'], ['hex', 'hex_decode'], ['base32', 'base32_decode'],
      ['URL-encoded', 'url_decode'], ['ROT13', 'rot13'],
    ]
    const fakes: Record<string, Utility> = {
      detect_format: {
        id: 'detect_format', name: 'detect', category: 'Analysis', params: {},
        apply: () => formats.map(([format], i) => ({ format, confidence: 0.9 - i * 0.1, note: '' })),
      },
    }
    for (const [, id] of formats) fakes[id] = { id, name: id, category: 'Decoding', params: {}, apply: () => `via ${id}` }
    const load = vi.spyOn(registry, 'load').mockImplementation(async id => fakes[id])
    try {
      render(<Harness initialInput="anything" />)
      await screen.findByText('via base64_decode', {}, { timeout: 5000 })
      expect(screen.getAllByRole('listitem')).toHaveLength(3)
      expect(screen.queryByText('via url_decode')).toBeNull()
    } finally {
      load.mockRestore()
    }
  })

  it('announces analysis through a polite status region', async () => {
    render(<Harness initialInput={btoa('Hello, World!')} />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/suggestion/), { timeout: 5000 })
  })

  it('drops suggestions for the previous input as soon as the input changes', async () => {
    render(<Harness initialInput={btoa('Hello, World!')} />)
    await screen.findByText('base64 decode', {}, { timeout: 5000 })
    fireEvent.click(screen.getByText('set plain input'))
    // a click here would add a base64 decoder to a pipeline whose input is not base64
    expect(screen.queryByText('base64 decode')).toBeNull()
  })

  it('says so when nothing obvious applies, instead of an empty list', async () => {
    render(<Harness initialInput="just some plain words" />)
    expect(await screen.findByText(/no obvious decoding/i, {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryByText(/a few things this could be/i)).toBeNull()
    expect(screen.queryByRole('list', { name: 'suggested first steps' })).toBeNull()
  })

  it('does not analyse very large input automatically', async () => {
    render(<Harness initialInput={'QUJD'.repeat(300_000)} />)
    expect(await screen.findByText(/too large to analyse automatically/i)).toBeTruthy()
    await new Promise(r => setTimeout(r, 400))
    expect(screen.queryByText('base64 decode')).toBeNull()
  })
})
