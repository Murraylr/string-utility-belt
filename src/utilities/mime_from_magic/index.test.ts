import { describe, it, expect } from 'vitest'
import util from './index'

type Detection = { mime: string; extension: string; description: string; confidence: number }

const detect = async (input: string | Uint8Array) => (await util.apply(input, {})) as unknown as Detection

/** Build a byte array from an ASCII prefix plus optional trailing bytes. */
const bytes = (prefix: number[], padTo = 0): Uint8Array => {
  const out = new Uint8Array(Math.max(prefix.length, padTo))
  out.set(prefix)
  return out
}

const asciiBytes = (s: string): number[] => [...s].map((c) => c.charCodeAt(0))

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]
// 1x1 transparent PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/**
 * Minimal ZIP local file header carrying a stored `mimetype` entry, the way EPUB and
 * OpenDocument archives start. `extraLength` exercises the header field that shifts the
 * payload away from the naive offset of 38.
 */
const mimetypeZip = (declared: string, extraLength = 0): Uint8Array => {
  const name = 'mimetype'
  const out = new Uint8Array(30 + name.length + extraLength + declared.length)
  out.set([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 0, 0]) // signature, version, flags, method 0 (stored)
  out[26] = name.length
  out[28] = extraLength
  out.set(asciiBytes(name), 30)
  out.set(asciiBytes(declared), 30 + name.length + extraLength)
  return out
}

/** MZ header whose e_lfanew at 0x3C points at a real `PE\0\0` signature. */
const peExecutable = (): Uint8Array => {
  const out = new Uint8Array(0x48)
  out.set([0x4d, 0x5a, 0x90, 0x00])
  out[0x3c] = 0x40 // e_lfanew
  out.set([0x50, 0x45, 0x00, 0x00], 0x40)
  return out
}

describe('mime_from_magic', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('mime_from_magic')
    expect(util.name).toBe('detect file type')
    expect(util.category).toBe('Analysis')
    expect(util.accepts).toEqual(['string', 'bytes'])
    expect(util.produces).toBe('json')
    expect(util.params).toEqual({})
  })

  it('identifies common image signatures from raw bytes', async () => {
    const png = await detect(bytes(PNG_HEADER))
    expect(png.mime).toBe('image/png')
    expect(png.extension).toBe('png')
    expect(png.description).toBe('PNG image')
    expect(png.confidence).toBe(1)

    expect((await detect(bytes([0xff, 0xd8, 0xff, 0xe0]))).mime).toBe('image/jpeg')
    expect((await detect(bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).extension).toBe('gif')
    expect((await detect(bytes([0x49, 0x49, 0x2a, 0x00]))).mime).toBe('image/tiff')
    expect((await detect(bytes([0x4d, 0x4d, 0x00, 0x2a]))).mime).toBe('image/tiff')
  })

  it('returns a real object, not a JSON string', async () => {
    const r = await util.apply(bytes(PNG_HEADER), {})
    expect(typeof r).toBe('object')
    expect(Object.keys(r as object).sort()).toEqual(['confidence', 'description', 'extension', 'mime'])
  })

  it('disambiguates RIFF and ISO-BMFF containers by their inner brand', async () => {
    const riff = (form: string) => bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, ...asciiBytes(form)])
    expect((await detect(riff('WEBP'))).mime).toBe('image/webp')
    expect((await detect(riff('WAVE'))).mime).toBe('audio/wav')
    expect((await detect(riff('AVI '))).extension).toBe('avi')

    const ftyp = (brand: string) => bytes([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70, ...asciiBytes(brand)])
    expect((await detect(ftyp('isom'))).mime).toBe('video/mp4')
    expect((await detect(ftyp('avif'))).mime).toBe('image/avif')
    expect((await detect(ftyp('heic'))).mime).toBe('image/heic')
    expect((await detect(ftyp('M4A '))).mime).toBe('audio/mp4')
    expect((await detect(ftyp('qt  '))).mime).toBe('video/quicktime')
    // the whole 3gp1..3gp9 / 3g2a family, not just the three brands that got listed
    expect((await detect(ftyp('3gp4'))).mime).toBe('video/3gpp')
    expect((await detect(ftyp('3gp1'))).mime).toBe('video/3gpp')
    expect((await detect(ftyp('3g2a'))).mime).toBe('video/3gpp2')
  })

  it('tells Matroska and WebM apart by the EBML DocType', async () => {
    const ebml = (docType: string) =>
      bytes([0x1a, 0x45, 0xdf, 0xa3, 0x93, 0x42, 0x82, 0x88, ...asciiBytes(docType)])
    expect((await detect(ebml('matroska'))).mime).toBe('video/x-matroska')
    expect((await detect(ebml('matroska'))).extension).toBe('mkv')
    expect((await detect(ebml('webm'))).mime).toBe('video/webm')
    // no DocType visible: still EBML, but say so with lower confidence
    const bare = await detect(bytes([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x02]))
    expect(bare.mime).toBe('video/x-matroska')
    expect(bare.confidence).toBeLessThan(0.95)
  })

  it('identifies archives, executables and databases', async () => {
    expect((await detect(bytes([0x1f, 0x8b, 0x08, 0x00]))).mime).toBe('application/gzip')
    expect((await detect(bytes([0x50, 0x4b, 0x03, 0x04]))).mime).toBe('application/zip')
    expect((await detect(bytes([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))).extension).toBe('7z')
    expect((await detect(bytes([0x42, 0x5a, 0x68, 0x39]))).mime).toBe('application/x-bzip2')
    expect((await detect(bytes([0x7f, 0x45, 0x4c, 0x46, 0x02]))).mime).toBe('application/x-executable')
    expect((await detect(bytes([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]))).mime).toBe('application/wasm')
    // "SQLite format 3" is followed by a NUL terminator, not a space
    const sqlite = bytes([...asciiBytes('SQLite format 3'), 0x00, 0x10, 0x00, 0x01, 0x01])
    expect((await detect(sqlite)).extension).toBe('sqlite')
    expect((await detect(bytes(asciiBytes('SQLite format 3 not really')))).extension).not.toBe('sqlite')
  })

  it('looks inside ZIP containers to name the real format', async () => {
    const epub = await detect(mimetypeZip('application/epub+zip'))
    expect(epub.mime).toBe('application/epub+zip')
    expect(epub.extension).toBe('epub')

    // the mimetype payload moves when the entry carries an extra field
    const odt = await detect(mimetypeZip('application/vnd.oasis.opendocument.text', 4))
    expect(odt.mime).toBe('application/vnd.oasis.opendocument.text')
    expect(odt.extension).toBe('odt')

    const docx = bytes([
      0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 8, 0,
      ...asciiBytes('..[Content_Types].xml..word/document.xml..')
    ])
    expect((await detect(docx)).extension).toBe('docx')
    expect((await detect(bytes([0x50, 0x4b, 0x03, 0x04, 20, 0, 0, 0, 8, 0]))).mime).toBe('application/zip')
  })

  it('requires a believable DOS header before calling something an executable', async () => {
    const pe = await detect(peExecutable())
    expect(pe.mime).toBe('application/vnd.microsoft.portable-executable')
    expect(pe.confidence).toBe(1)

    // prose that merely starts with "MZ" is text, however long it is
    const prose = 'MZ is a signature that appears at the start of DOS executables, and this line is long.'
    expect(prose.length).toBeGreaterThan(0x40)
    expect((await detect(prose)).mime).toBe('text/plain')
  })

  it('accepts a hex or base64 rendering of the leading bytes', async () => {
    expect((await detect('89504e470d0a1a0a0000000d')).mime).toBe('image/png')
    expect((await detect('89 50 4e 47 0d 0a 1a 0a')).extension).toBe('png')
    expect((await detect('0x89504e470d0a1a0a')).extension).toBe('png')
    expect((await detect(PNG_BASE64)).mime).toBe('image/png')
    expect((await detect('JVBERi0xLjcKJeLjz9MK')).mime).toBe('application/pdf')
    expect((await detect('H4sIAAAAAAAAAw==')).mime).toBe('application/gzip')
  })

  it('reads a literal signature that would also parse as base64', async () => {
    // "GIF89aXY" is valid base64 too — the literal reading is the confident one.
    expect((await detect('GIF89aXY')).mime).toBe('image/gif')
    expect((await detect('%PDF-1.7\n1 0 obj')).mime).toBe('application/pdf')
  })

  it('falls back to text sniffing when there is no binary signature', async () => {
    expect((await detect('<?xml version="1.0"?><note/>')).mime).toBe('application/xml')
    expect((await detect('<?xml version="1.0"?><svg xmlns="x"/>')).mime).toBe('image/svg+xml')
    expect((await detect('<!DOCTYPE html><html></html>')).extension).toBe('html')
    expect((await detect('{"a":1,"b":[2,3]}')).mime).toBe('application/json')
    expect((await detect('#!/usr/bin/env bash\necho hi')).extension).toBe('sh')
    expect((await detect('-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----')).extension).toBe('pem')
    const plain = await detect('just some words here')
    expect(plain.mime).toBe('text/plain')
    expect(plain.confidence).toBeLessThan(1)
    // "{" that is not valid JSON must not be reported as JSON
    expect((await detect('{not json at all'))!.mime).toBe('text/plain')
  })

  it('only calls "%!PS" PostScript, not every "%!" magic comment', async () => {
    expect((await detect('%!PS-Adobe-3.0\n/Times-Roman findfont')).mime).toBe('application/postscript')
    expect((await detect('%!TEX root = main.tex')).mime).toBe('text/plain')
  })

  it('reads byte-order marks as text instead of as an MPEG frame', async () => {
    // FF FE passes a naive 11-bit MPEG sync test; it is a UTF-16LE BOM.
    const utf16le = await detect(bytes([0xff, 0xfe, 0x68, 0x00, 0x69, 0x00]))
    expect(utf16le.mime).toBe('text/plain')
    expect(utf16le.description).toMatch(/UTF-16LE/)
    expect((await detect(bytes([0xfe, 0xff, 0x00, 0x68]))).mime).toBe('text/plain')
    expect((await detect(bytes([0xff, 0xfe, 0x00, 0x00]))).description).toMatch(/UTF-32LE/)
    // a genuine MPEG frame header is still detected
    expect((await detect(bytes([0xff, 0xfb, 0x90, 0x00]))).mime).toBe('audio/mpeg')
    expect((await detect(bytes([0x49, 0x44, 0x33, 0x03, 0x00]))).description).toMatch(/ID3/)
  })

  it('handles non-ASCII text without throwing or mangling it', async () => {
    const r = await detect('héllo wörld 🎉 中文')
    expect(r.mime).toBe('text/plain')
    expect(r.confidence).toBeGreaterThan(0)
  })

  it('does not mistake ordinary words for BMP or executables', async () => {
    expect((await detect('BMW is a car brand')).mime).toBe('text/plain')
    expect((await detect('MZ is a signature')).mime).toBe('text/plain')
    // a real BMP header has zeroed reserved fields
    expect((await detect(bytes([0x42, 0x4d, 0x36, 0x00, 0x0c, 0x00, 0, 0, 0, 0, 0x36, 0, 0, 0]))).mime).toBe(
      'image/bmp'
    )
  })

  it('reports unknown binary data instead of guessing', async () => {
    const r = await detect(bytes([0x13, 0x37, 0x42, 0x99, 0x01, 0x02]))
    expect(r.mime).toBe('application/octet-stream')
    expect(r.confidence).toBe(0)
  })

  it('returns an empty result for empty input without throwing', async () => {
    expect(await detect('')).toEqual({ mime: '', extension: '', description: '', confidence: 0 })
    expect(await detect(new Uint8Array(0))).toEqual({ mime: '', extension: '', description: '', confidence: 0 })
    // whitespace is still text, not unrecognised binary data
    expect((await detect('   \n  ')).mime).toBe('text/plain')
  })

  it('throws on structured input', () => {
    expect(() => util.apply({ file: 'x' } as never, {})).toThrow(/structured data/)
  })
})
