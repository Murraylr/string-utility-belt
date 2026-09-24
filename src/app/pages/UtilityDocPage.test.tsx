import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { getRoute, onRouteChange } from '@/lib/router'
import UtilityDocPage from './UtilityDocPage'

const STORAGE_KEY = 'string-utility-belt'

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
  location.hash = ''
})

const playgroundOutput = () => screen.getByRole('status', { name: 'playground output' })

describe('UtilityDocPage', () => {
  it('renders name, description and category', () => {
    render(<UtilityDocPage id="trim" />)
    const heading = screen.getByRole('heading', { level: 1, name: 'trim' })
    expect(screen.getByText('Remove leading and trailing whitespace.')).toBeTruthy()
    expect(within(heading.closest('header')!).getByText('String Ops')).toBeTruthy()
  })

  it('sets the document title and meta description, and restores both on leaving', () => {
    document.title = 'String Utility Belt'
    const { unmount } = render(<UtilityDocPage id="trim" />)
    expect(document.title).toBe('trim — String Utility Belt')
    const meta = document.querySelector('meta[name="description"]')
    expect(meta?.getAttribute('content')).toBe('Remove leading and trailing whitespace.')

    unmount()
    // otherwise the tool page keeps a stale "trim — …" tab title and description
    expect(document.title).toBe('String Utility Belt')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null)
      .not.toBe('Remove leading and trailing whitespace.')
  })

  it('shows a friendly not-found for an unknown id, with a link to browse utilities', () => {
    render(<UtilityDocPage id="does-not-exist" />)
    expect(screen.getByText(/unknown utility/i)).toBeTruthy()
    const link = screen.getByRole('link', { name: /browse all utilities/i })
    expect(link.getAttribute('href')).toBe('#/utilities')
  })

  it('renders a params table with kind, default, bounds and a description', () => {
    render(<UtilityDocPage id="pad" />)
    const table = within(screen.getByRole('table'))
    expect(table.getByText('length')).toBeTruthy()
    expect(table.getByText('char')).toBeTruthy()
    expect(table.getByText('side')).toBeTruthy()
    expect(table.getByText('10')).toBeTruthy() // length's default
    expect(table.getByText(/0–1000000/)).toBeTruthy() // length's bounds (capped: amplifying param)
    expect(table.getByText('end, start, both')).toBeTruthy() // side's options
    expect(table.getByText('target length')).toBeTruthy() // no description: falls back to the label
  })

  it('shows environment notes', () => {
    render(<UtilityDocPage id="custom_js" />)
    expect(screen.getByText(/never run this on a server/i)).toBeTruthy()
  })

  it('renders worked examples with input and output', async () => {
    render(<UtilityDocPage id="count" />)
    expect(await screen.findByText('a couple of lines', {}, { timeout: 5000 })).toBeTruthy()
    // getByText's default normalizer collapses newlines, so compare raw textContent instead.
    expect(screen.getByText(/Hello world/).textContent).toBe('Hello world\nfoo bar baz')
    expect(screen.getByText(/characters: 23/).textContent).toBe('characters: 23\nwords: 5\nlines: 2')
  })

  it('labels an example input that is not plain text with its encoding', async () => {
    render(<UtilityDocPage id="gzip_decompress" />)
    expect(await screen.findByText('decompress a gzip stream to text', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.getByText(/input \(hex\)/i)).toBeTruthy()
  })

  it('runs the playground and shows output as the input changes', async () => {
    render(<UtilityDocPage id="trim" />)
    fireEvent.change(screen.getByLabelText('playground input'), { target: { value: '  padded  ' } })
    await waitFor(() => expect(playgroundOutput().textContent).toBe('padded'), { timeout: 5000 })
  })

  it('re-runs the playground when a param changes', async () => {
    const { container } = render(<UtilityDocPage id="pad" />)
    fireEvent.change(screen.getByLabelText('playground input'), { target: { value: 'ab' } })
    await waitFor(() => expect(playgroundOutput().textContent).toBe('ab        '), { timeout: 5000 })
    fireEvent.change(screen.getByLabelText('pad character'), { target: { value: '*' } })
    await waitFor(() => expect(playgroundOutput().textContent).toBe('ab********'), { timeout: 5000 })
    // its controls are namespaced so they can never collide with a step editor's ids
    expect(container.querySelector('[id^="doc-playground-pad-"]')).toBeTruthy()
  })

  it('shows a utility error in the playground politely (it fires while typing)', async () => {
    render(<UtilityDocPage id="json_pretty" />)
    fireEvent.change(screen.getByLabelText('playground input'), { target: { value: '{not json' } })
    const status = await screen.findByRole('status', { name: 'playground error' }, { timeout: 5000 })
    expect(status.textContent).not.toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(playgroundOutput().textContent).toBe('')
  })

  it('loads a worked example into the playground', async () => {
    render(<UtilityDocPage id="pad" />)
    fireEvent.click(await screen.findByRole('button', { name: /try example: zero-pad a number/i }, { timeout: 5000 }))
    expect((screen.getByLabelText('playground input') as HTMLTextAreaElement).value).toBe('42')
    await waitFor(() => expect(playgroundOutput().textContent).toBe('000042'), { timeout: 5000 })
  })

  it('appends the step (with the playground params) to the saved pipeline and navigates home', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 2, steps: [{ id: 'a', utilityId: 'trim', enabled: true, params: {} }], showPreviews: true }))
    render(<UtilityDocPage id="pad" />)
    fireEvent.change(screen.getByLabelText('pad character'), { target: { value: '*' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use in pipeline' }))
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    expect(saved.steps.map((s: { utilityId: string }) => s.utilityId)).toEqual(['trim', 'pad'])
    expect(saved.steps[1].params).toEqual({ length: 10, char: '*', side: 'end' })
    expect(location.hash).toBe('#/')
  })

  it('"Use in pipeline" opens the tool even from the pre-rendered /util/<id>/ page', () => {
    // there the path itself routes to this doc page, so '#/' alone would land right back here
    history.replaceState(null, '', '/util/pad/')
    try {
      expect(getRoute().name).toBe('utility')
      const onRoute = vi.fn()
      const off = onRouteChange(onRoute)
      render(<UtilityDocPage id="pad" />)
      fireEvent.click(screen.getByRole('button', { name: 'Use in pipeline' }))
      off()
      expect(getRoute().name).toBe('home')
      expect(onRoute).toHaveBeenCalledWith(expect.objectContaining({ name: 'home' }))
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
      expect(saved.steps.map((s: { utilityId: string }) => s.utilityId)).toEqual(['pad'])
    } finally {
      history.replaceState(null, '', '/')
    }
  })

  it('titles the not-found page', () => {
    document.title = 'String Utility Belt'
    const { unmount } = render(<UtilityDocPage id="does-not-exist" />)
    expect(document.title).toBe('Unknown utility — String Utility Belt')
    unmount()
    expect(document.title).toBe('String Utility Belt')
  })

  it('lists the most closely related utilities first', () => {
    render(<UtilityDocPage id="url_decode" />)
    const section = screen.getByRole('heading', { name: 'Related utilities' }).closest('section')!
    const links = within(section).getAllByRole('link')
    expect(links.length).toBeLessThanOrEqual(6)
    expect(links[0].getAttribute('href')).toBe('#/util/url_encode')
  })
})
