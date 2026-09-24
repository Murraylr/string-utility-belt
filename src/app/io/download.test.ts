import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { pickDownload, slugifyBaseName, sniffBytesExtension, triggerDownload } from './download'

describe('slugifyBaseName', () => {
  it('slugifies a name', () => {
    expect(slugifyBaseName('My Cool Pipeline!')).toBe('my-cool-pipeline')
  })
  it('strips accents and caps very long names', () => {
    expect(slugifyBaseName('Café Crème')).toBe('cafe-creme')
    expect(slugifyBaseName('a'.repeat(300)).length).toBeLessThanOrEqual(80)
    expect(slugifyBaseName(`${'a'.repeat(79)} b`)).toBe('a'.repeat(79))
  })
  it('falls back to "result" when empty/undefined', () => {
    expect(slugifyBaseName(undefined)).toBe('result')
    expect(slugifyBaseName('   ')).toBe('result')
  })
})

describe('sniffBytesExtension', () => {
  it('recognises PNG, JPG, GIF, PDF, ZIP, GZIP and WASM magic numbers', () => {
    expect(sniffBytesExtension(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])).ext).toBe('png')
    expect(sniffBytesExtension(new Uint8Array([0xff, 0xd8, 0xff, 0])).ext).toBe('jpg')
    expect(sniffBytesExtension(new Uint8Array([0x47, 0x49, 0x46, 0x38])).ext).toBe('gif')
    expect(sniffBytesExtension(new Uint8Array([0x25, 0x50, 0x44, 0x46])).ext).toBe('pdf')
    expect(sniffBytesExtension(new Uint8Array([0x50, 0x4b, 0x03, 0x04])).ext).toBe('zip')
    expect(sniffBytesExtension(new Uint8Array([0x1f, 0x8b, 0])).ext).toBe('gz')
    expect(sniffBytesExtension(new Uint8Array([0x00, 0x61, 0x73, 0x6d])).ext).toBe('wasm')
  })
  it('falls back to .bin for unrecognised bytes', () => {
    expect(sniffBytesExtension(new Uint8Array([1, 2, 3, 4])).ext).toBe('bin')
  })
})

describe('pickDownload', () => {
  it('downloads bytes raw, named by their sniffed magic number', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2])
    const plan = pickDownload(bytes, 'my pipe')
    expect(plan.filename).toBe('my-pipe.png')
    expect(plan.mime).toBe('image/png')
    expect(plan.data).toBeInstanceOf(Uint8Array)
  })

  it('names a json value result.json', () => {
    const plan = pickDownload({ a: 1 }, undefined)
    expect(plan.filename).toBe('result.json')
    expect(plan.mime).toBe('application/json')
  })

  it('detects a JSON-parsable string as .json', () => {
    const plan = pickDownload('[1,2,3]', 'nums')
    expect(plan.filename).toBe('nums.json')
  })

  it('detects xml as .xml', () => {
    const plan = pickDownload('<root><a/></root>', 'doc')
    expect(plan.filename).toBe('doc.xml')
    expect(plan.mime).toBe('application/xml')
  })

  it('detects a csv-shaped string as .csv', () => {
    const plan = pickDownload('a,b\n1,2\n3,4', 'data')
    expect(plan.filename).toBe('data.csv')
  })

  it('detects markdown as .md', () => {
    const plan = pickDownload('# Title\n\nbody', 'readme')
    expect(plan.filename).toBe('readme.md')
  })

  it('downloads bytes as the exact raw bytes, not their formatted text', () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const plan = pickDownload(bytes, 'x')
    expect(plan.filename).toBe('x.bin')
    expect(plan.mime).toBe('application/octet-stream')
    expect(Array.from(plan.data as Uint8Array)).toEqual([0xde, 0xad, 0xbe, 0xef])
  })

  it('names html output .html rather than .xml', () => {
    const plan = pickDownload('<html><body>hi</body></html>', 'page')
    expect(plan.filename).toBe('page.html')
    expect(plan.mime).toBe('text/html;charset=utf-8')
    expect(pickDownload('<!DOCTYPE html>\n<p>hi</p>', 'page').filename).toBe('page.html')
  })

  it('detects a self-closing xml root and an xml declaration', () => {
    expect(pickDownload('<root/>', 'd').filename).toBe('d.xml')
    expect(pickDownload('<?xml version="1.0"?>\n<a>1</a>', 'd').filename).toBe('d.xml')
  })

  it('declares utf-8 on every text MIME type', () => {
    expect(pickDownload('a,b\n1,2', 'd').mime).toBe('text/csv;charset=utf-8')
    expect(pickDownload('# t', 'd').mime).toBe('text/markdown;charset=utf-8')
  })

  it('pretty-prints a json value and keeps a JSON-parsable string verbatim', () => {
    expect(pickDownload([1, { a: 2 }], undefined).data).toBe('[\n  1,\n  {\n    "a": 2\n  }\n]')
    expect(pickDownload('{"a":1}', undefined).data).toBe('{"a":1}')
  })

  it('falls back to .txt for plain text', () => {
    const plan = pickDownload('just some words', 'notes')
    expect(plan.filename).toBe('notes.txt')
    expect(plan.mime).toBe('text/plain;charset=utf-8')
  })
})

describe('triggerDownload', () => {
  const originalCreate = URL.createObjectURL
  const originalRevoke = URL.revokeObjectURL

  beforeEach(() => {
    vi.useFakeTimers()
    URL.createObjectURL = vi.fn(() => 'blob:mock-url')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    URL.createObjectURL = originalCreate
    URL.revokeObjectURL = originalRevoke
  })

  it('clicks an attached download link, removes it, and revokes the URL only after the download has started', () => {
    const attachedAtClick: boolean[] = []
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      attachedAtClick.push(document.body.contains(this)) // Firefox ignores clicks on detached anchors
    })
    triggerDownload({ filename: 'x.txt', mime: 'text/plain', data: 'hi' })
    expect(clickSpy).toHaveBeenCalledTimes(1)
    const clicked = clickSpy.mock.contexts[0] as HTMLAnchorElement
    expect(attachedAtClick).toEqual([true])
    expect(clicked.download).toBe('x.txt')
    expect(clicked.href).toBe('blob:mock-url')
    expect(document.body.contains(clicked)).toBe(false)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
    clickSpy.mockRestore()
  })

  it('builds the Blob from the plan with its MIME type', () => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    triggerDownload({ filename: 'x.bin', mime: 'application/octet-stream', data: new Uint8Array([1, 2]) })
    const blob = (URL.createObjectURL as any).mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/octet-stream')
    expect(blob.size).toBe(2)
  })
})
