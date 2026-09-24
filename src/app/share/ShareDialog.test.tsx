import type { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ToolProvider } from '@/app/ToolContext'
import LZString from 'lz-string'
import { decodeShare } from '@/core/serialize'
import ShareDialog from './ShareDialog'

const steps = [{ id: 's1', utilityId: 'trim', enabled: true, params: {} }]

function renderDialog(initialInput: any = 'hello world', extra: Partial<ComponentProps<typeof ToolProvider>> = {}) {
  return render(
    <ToolProvider initialSteps={steps} initialName="my pipeline" initialInput={initialInput} {...extra}>
      <ShareDialog onClose={() => {}} />
    </ToolProvider>
  )
}

const getLinkTextarea = () => screen.getByLabelText('link') as HTMLTextAreaElement
const payloadOf = (url: string) => url.split('#/p/')[1]

// Repeated characters compress to almost nothing under lz-string, so a genuinely
// long *link* needs high-entropy input — a run of one character would not trip
// the length warning no matter how long it is.
function incompressibleText(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < length; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

/** jsdom's Blob has no `.text()`/`.arrayBuffer()`; FileReader is the one API that can read it. */
function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

// `userEvent.setup()` installs its own jsdom clipboard polyfill, replacing whatever
// `navigator.clipboard` held before it — so the mock must be installed AFTER setup(),
// not in a beforeEach that runs before it.
function mockClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  return writeText
}

describe('ShareDialog', () => {
  it('is an accessible, labelled dialog', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Share pipeline' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
  })

  it('builds a #/p/<payload> link from the current steps and name, with input excluded by default', () => {
    renderDialog('hello world')
    const url = getLinkTextarea().value
    expect(url).toContain('#/p/')
    const doc = decodeShare(payloadOf(url))
    expect(doc.name).toBe('my pipeline')
    expect(doc.steps).toHaveLength(1)
    expect(doc.input).toBeUndefined()
    expect(screen.getByRole('checkbox', { name: 'Include my input' })).not.toBeChecked()
  })

  it('encodes the link as a schema v2 document', () => {
    renderDialog()
    const raw = JSON.parse(LZString.decompressFromEncodedURIComponent(payloadOf(getLinkTextarea().value))!)
    expect(raw.v).toBe(2)
  })

  it('includes the (possibly unicode) input once the checkbox is checked', async () => {
    const user = userEvent.setup()
    renderDialog('héllo 世界 🎉')
    await user.click(screen.getByRole('checkbox', { name: 'Include my input' }))
    const doc = decodeShare(payloadOf(getLinkTextarea().value))
    expect(doc.input).toBe('héllo 世界 🎉')
  })

  it('disables "include my input" and explains why when the pipeline input is bytes', () => {
    renderDialog(new Uint8Array([1, 2, 3]))
    const checkbox = screen.getByRole('checkbox', { name: 'Include my input' })
    expect(checkbox).toBeDisabled()
    expect(screen.getByText(/binary input can.t be shared/i)).toBeInTheDocument()
  })

  it('warns above 8,000 characters', async () => {
    const user = userEvent.setup()
    renderDialog(incompressibleText(9000))
    await user.click(screen.getByRole('checkbox', { name: 'Include my input' }))
    expect(getLinkTextarea().value.length).toBeGreaterThan(8000)
    expect(screen.getByRole('alert')).toHaveTextContent(/quite long/i)
  })

  it('does not warn for a short link', () => {
    renderDialog('short')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('copies the link and announces it via aria-live', async () => {
    const user = userEvent.setup()
    const writeText = mockClipboard()
    renderDialog()
    const url = getLinkTextarea().value
    await user.click(screen.getByRole('button', { name: /copy link/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(url))
    expect(screen.getByRole('status')).toHaveTextContent(/copied/i)
  })

  it('the embed tab shows an iframe snippet pointing at #/embed/<payload> with a working sandbox', async () => {
    const user = userEvent.setup()
    renderDialog()
    await user.click(screen.getByRole('tab', { name: 'Embed' }))
    const snippet = (screen.getByLabelText('embed snippet') as HTMLTextAreaElement).value
    expect(snippet).toContain('<iframe')
    expect(snippet).toMatch(/src="[^"]*#\/embed\//)
    expect(snippet).toContain('width="100%"')
    expect(snippet).toContain('height="420"')
    expect(snippet).toContain('loading="lazy"')
    const sandbox = snippet.match(/sandbox="([^"]*)"/)![1].split(' ')
    // enough for the app to run, and for "open in" to open a normal, unsandboxed tab
    expect(sandbox).toEqual(expect.arrayContaining(['allow-scripts', 'allow-same-origin', 'allow-popups', 'allow-popups-to-escape-sandbox']))
    expect(sandbox).not.toContain('allow-top-navigation')
    // the snippet's payload decodes back to the same pipeline
    const embedPayload = snippet.match(/#\/embed\/([^"]+)"/)![1]
    expect(decodeShare(embedPayload).steps).toHaveLength(1)
    expect(snippet).toMatch(/title="[^"]+"/)
  })

  it('downloads a PipelineDoc v2 JSON file', async () => {
    const user = userEvent.setup()
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    // jsdom does not implement the Blob URL registry at all, so these are defined
    // fresh rather than spied on (there is nothing to spy on yet).
    const createObjectURL = vi.fn().mockReturnValue('blob:mock')
    const revokeObjectURL = vi.fn()
    ;(URL as any).createObjectURL = createObjectURL
    ;(URL as any).revokeObjectURL = revokeObjectURL
    renderDialog()
    await user.click(screen.getByRole('button', { name: /download \.json/i }))
    expect(clickSpy).toHaveBeenCalled()
    expect(createObjectURL).toHaveBeenCalled()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    const text = await blobToText(blob)
    const doc = JSON.parse(text)
    expect(doc.v).toBe(2)
    expect(doc.name).toBe('my pipeline')
    expect(doc.steps).toHaveLength(1)
    expect(doc.input).toBeUndefined() // input stays private unless opted in
    const anchor = clickSpy.mock.contexts[0] as HTMLAnchorElement
    expect(anchor.download).toBe('my-pipeline.json')
    clickSpy.mockRestore()
  })

  it('tabs are keyboard operable (arrow keys move and select)', async () => {
    const user = userEvent.setup()
    renderDialog()
    const linkTab = screen.getByRole('tab', { name: 'Link' })
    linkTab.focus()
    await user.keyboard('{ArrowRight}')
    const embedTab = screen.getByRole('tab', { name: 'Embed' })
    expect(embedTab).toHaveAttribute('aria-selected', 'true')
    expect(document.activeElement).toBe(embedTab)
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', embedTab.id)
    expect(screen.getByLabelText('embed snippet')).toBeInTheDocument()
  })

  it('announces a failed copy instead of failing silently', async () => {
    const user = userEvent.setup()
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) }, configurable: true })
    renderDialog()
    await user.click(screen.getByRole('button', { name: /copy link/i }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/copy failed/i))
  })
})
