import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { encodeShare } from '@/core/serialize'
import EmbedPage from './EmbedPage'

const trim = { id: 's1', utilityId: 'trim', enabled: true, params: {} }

beforeEach(() => {
  localStorage.clear()
  history.replaceState(null, '', '/some/path')
})

/** The rendered result box (not the textarea, which also contains the input text). */
const result = () => screen.getByLabelText('Result')

// Each run lazily imports its utility's chunk; cold, under a loaded machine, that
// alone can outlast waitFor's 1s default.
const RUN = { timeout: 10_000 }

describe('EmbedPage', { timeout: 30_000 }, () => {
  it('shows a readable alert for a payload that does not decode', () => {
    render(<EmbedPage payload="not-a-valid-payload" />)
    expect(screen.getByRole('alert')).toHaveTextContent(/does not contain a pipeline|corrupted/i)
  })

  it('renders the prefilled input, the step list, the result, and an "open in" link — without touching localStorage', async () => {
    const payload = encodeShare({ v: 2, steps: [trim], input: '  hi  ' })
    render(<EmbedPage payload={payload} />)

    expect(screen.getByLabelText('Input')).toHaveValue('  hi  ')
    expect(screen.getByRole('list', { name: 'Steps' })).toHaveTextContent('trim')

    await waitFor(() => expect(result().textContent).toBe('hi'), RUN)

    const link = screen.getByRole('link', { name: /open in string utility belt/i }) as HTMLAnchorElement
    expect(link.href).toBe(`${location.origin}/some/path#/p/${payload}`)
    expect(link.target).toBe('_blank')
    expect(link.rel).toContain('noopener')

    expect(localStorage.length).toBe(0)
  })

  it('re-runs as the viewer types, still without writing to the host site\'s storage', async () => {
    const user = userEvent.setup()
    const payload = encodeShare({ v: 2, steps: [{ id: 'u', utilityId: 'case', enabled: true, params: { mode: 'upper' } }], input: 'a' })
    render(<EmbedPage payload={payload} />)
    await waitFor(() => expect(result().textContent).toBe('A'), RUN)

    await user.type(screen.getByLabelText('Input'), 'bc')
    await waitFor(() => expect(result().textContent).toBe('ABC'), RUN)
    expect(localStorage.length).toBe(0)
  })

  it('quarantines a custom_js step instead of running it, and says so', async () => {
    const payload = encodeShare({
      v: 2,
      steps: [{ id: 's1', utilityId: 'custom_js', enabled: true, params: { code: 'return "ran"' } }],
      input: 'x',
    })
    render(<EmbedPage payload={payload} />)
    // the step is listed but disabled, so the input passes through unchanged
    await waitFor(() => expect(result().textContent).toBe('x'), RUN)
    expect(screen.getByText(/custom code.*disabled/i)).toBeInTheDocument()
    expect(localStorage.length).toBe(0)
  })

  it('runs a "run on each" step per line, lists it by what it does, and quarantines custom code inside it', async () => {
    const payload = encodeShare({
      v: 3,
      steps: [{
        id: 'e', type: 'each', enabled: true, split: { mode: 'lines' }, skipEmpty: true,
        steps: [
          { id: 'd', utilityId: 'base64_decode', enabled: true, params: {} },
          { id: 'js', utilityId: 'custom_js', enabled: true, params: { code: 'return "ran"' } },
        ],
      }],
      input: 'aGk=\r\n\nYnll\n',
    })
    render(<EmbedPage payload={payload} />)
    expect(screen.getByRole('list', { name: 'Steps' })).toHaveTextContent('run on each line (2 steps)')
    expect(screen.getByText(/custom code.*disabled/i)).toBeInTheDocument()
    await waitFor(() => expect(result().textContent).toBe('hi\r\n\nbye\n'), RUN)
  })

  it('shows a step error instead of an empty result', async () => {
    const payload = encodeShare({
      v: 2,
      steps: [{ id: 'j', utilityId: 'json_pretty', enabled: true, params: {} }],
      input: '{not json',
    })
    render(<EmbedPage payload={payload} />)
    expect(await screen.findByRole('alert', {}, RUN)).toHaveTextContent(/.+/)
  })

  it('switches pipelines when the payload changes', async () => {
    const first = encodeShare({ v: 2, steps: [trim], input: '  one  ' })
    const second = encodeShare({ v: 2, steps: [{ id: 'u', utilityId: 'case', enabled: true, params: { mode: 'upper' } }], input: 'two' })
    const { rerender } = render(<EmbedPage payload={first} />)
    await waitFor(() => expect(result().textContent).toBe('one'), RUN)
    rerender(<EmbedPage payload={second} />)
    await waitFor(() => expect(result().textContent).toBe('TWO'), RUN)
    expect(screen.getByLabelText('Input')).toHaveValue('two')
  })

  it('supplies its own main landmark and a single h1 (it renders without the site chrome)', () => {
    const payload = encodeShare({ v: 2, name: 'Tidy', steps: [trim], input: 'x' })
    const { unmount } = render(<EmbedPage payload={payload} />)
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Tidy/)
    unmount()

    render(<EmbedPage payload="not-a-valid-payload" />)
    expect(screen.getByRole('main')).toContainElement(screen.getByRole('alert'))
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})
