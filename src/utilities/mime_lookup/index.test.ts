import { describe, it, expect } from 'vitest'
import util, { EXT_TO_MIME } from './index'

const run = (input: unknown, params: Record<string, unknown> = {}) =>
  util.apply(input as never, params) as string

describe('mime_lookup', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('mime_lookup')
    expect(util.name).toBe('mime type lookup')
    expect(util.category).toBe('Web & Dev')
    expect(util.accepts).toBe('string')
    expect(util.produces).toBe('string')
    expect(Object.keys(util.params).sort()).toEqual(['direction', 'perLine'])
    const direction = util.params.direction as { options: string[]; default: string }
    expect(direction.options).toEqual(['auto', 'extension-to-mime', 'mime-to-extension'])
    expect(direction.default).toBe('auto')
    expect((util.params.perLine as { default: boolean }).default).toBe(true)
  })

  it('ships a table with at least 200 extensions', () => {
    expect(Object.keys(EXT_TO_MIME).length).toBeGreaterThanOrEqual(200)
  })

  it('resolves an extension to a mime type in auto mode', async () => {
    expect(await util.apply('pdf', {})).toBe('application/pdf')
    expect(await util.apply('.PNG', {})).toBe('image/png')
    expect(await util.apply('reports/q3 summary.XLSX', {})).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    expect(await util.apply('https://example.com/logo.svg?v=2', {})).toBe('image/svg+xml')
    expect(await util.apply('C:\\Users\\me\\notes.md', {})).toBe('text/markdown')
    expect(await util.apply('archive.tar.gz', {})).toBe('application/gzip')
  })

  it('resolves a mime type to an extension in auto mode', async () => {
    expect(await util.apply('application/pdf', {})).toBe('pdf')
    expect(await util.apply('image/jpeg', {})).toBe('jpg')
    expect(await util.apply('text/html; charset=utf-8', {})).toBe('html')
    expect(await util.apply('IMAGE/PNG', {})).toBe('png')
  })

  it('round-trips extension -> mime -> extension, including aliases', async () => {
    for (const ext of ['pdf', 'png', 'zip', 'mp4', 'woff2', 'epub', 'wasm']) {
      const mime = (await util.apply(ext, {})) as string
      expect(await util.apply(mime, {})).toBe(ext)
    }
    expect(await util.apply('jpeg', {})).toBe('image/jpeg')
    expect(await util.apply('image/jpg', {})).toBe('jpg')
    expect(await util.apply('application/x-gzip', {})).toBe('gz')
    expect(await util.apply('text/yaml', {})).toBe('yaml')
  })

  it('keeps the whole table resolvable in both directions', () => {
    const forwardFailures: string[] = []
    const reverseFailures: string[] = []
    for (const [ext, mime] of Object.entries(EXT_TO_MIME)) {
      try {
        if (run(ext, { direction: 'extension-to-mime' }) !== mime) forwardFailures.push(ext)
      } catch {
        forwardFailures.push(ext)
      }
      try {
        const back = run(mime, { direction: 'mime-to-extension' })
        if (EXT_TO_MIME[back] === undefined) reverseFailures.push(mime)
      } catch {
        reverseFailures.push(mime)
      }
    }
    expect(forwardFailures).toEqual([])
    expect(reverseFailures).toEqual([])
  })

  it('honours direction = extension-to-mime even for slash-containing tokens', async () => {
    expect(await util.apply('src/main.ts', { direction: 'extension-to-mime' })).toBe('text/typescript')
    expect(await util.apply('audio/ogg', { direction: 'extension-to-mime' })).toBe('audio/ogg')
  })

  it('honours direction = mime-to-extension', async () => {
    expect(await util.apply('font/woff2', { direction: 'mime-to-extension' })).toBe('woff2')
    expect(await util.apply('application/vnd.custom.thing+xml', { direction: 'mime-to-extension' })).toBe('xml')
    expect(() => util.apply('pdf', { direction: 'mime-to-extension' })).toThrow(/not a valid mime type/)
    expect(() => util.apply('src/main.ts', { direction: 'mime-to-extension' })).toThrow(/no extension known/)
  })

  it('falls back to the path reading when a token only looks like a mime type', async () => {
    // "text/..." is a real top-level type, but these are paths, not media types
    expect(await util.apply('text/notes.md', {})).toBe('text/markdown')
    expect(await util.apply('video/holiday clip.mp4', {})).toBe('video/mp4')
    // ... while a genuine mime type whose subtype contains dots still resolves backwards
    expect(await util.apply('application/vnd.oasis.opendocument.text', {})).toBe('odt')
  })

  it('maps every line when perLine is true and the whole input when it is false', async () => {
    expect(await util.apply('pdf\nimage/png\n\nmp3', { perLine: true })).toBe(
      'application/pdf\npng\n\naudio/mpeg'
    )
    expect(await util.apply('pdf\r\nimage/png', { perLine: true })).toBe('application/pdf\npng')
    expect(await util.apply('  application/zip  \n', { perLine: false })).toBe('zip')
    expect(await util.apply('report.docx', { perLine: false })).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    )
  })

  it('returns empty output for empty or blank input', async () => {
    expect(await util.apply('', {})).toBe('')
    expect(await util.apply('   \n  ', {})).toBe('')
    expect(await util.apply('', { perLine: false })).toBe('')
  })

  it('throws a clear error for unknown extensions, including non-ASCII ones', () => {
    expect(() => util.apply('документ.пдф', {})).toThrow('no mime type known for extension ".пдф"')
    expect(() => util.apply('photo.🖼', {})).toThrow(/no mime type known for extension/)
    expect(() => util.apply('application/x-not-a-real-type', {})).toThrow(/no extension known for mime type/)
    expect(() => util.apply('image/*', {})).toThrow(/not a valid mime type/)
  })

  it('rejects structured input', () => {
    expect(() => util.apply({ ext: 'pdf' } as never, {})).toThrow(/structured data/)
  })
})
