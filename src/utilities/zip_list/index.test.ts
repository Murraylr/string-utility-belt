import { describe, it, expect } from 'vitest'
import util from './index'

/**
 * A real ZIP archive containing:
 *   hello.txt            (deflate)  "Hello, ZIP!"
 *   docs/readme.md       (deflate)  580 bytes of repeated markdown
 *   unicode/naïve-😀.txt (deflate)  "héllo wörld — 😀 ✓"
 *   raw/stored.bin       (stored)   7 raw bytes
 */
const ZIP =
  'UEsDBBQAAAAIAI8qZVjwg6nsDQAAAAsAAAAJAAAAaGVsbG8udHh080jNycnXUYjyDFAEAFBLAwQUAAAACACPKmVYPmfg3yUAAABEAgAADgAAAGRvY3MvcmVhZG1lLm1kU1YIySzJSeXiCs7PTVUoSa0oUShKLUhNLElN0VMYlRyVJEISAFBLAwQUAAAICACPKmVYWVHm9x0AAAAaAAAAFwAAAHVuaWNvZGUvbmHDr3ZlLfCfmIAudHh0yzi8MicnX6H88LainBSFRw1TFD7Mn9Gg8GjOZABQSwMEFAAAAAAAjyplWCqG7skHAAAABwAAAA4AAAByYXcvc3RvcmVkLmJpbgABAgP//v1QSwECFAAUAAAACACPKmVY8IOp7A0AAAALAAAACQAAAAAAAAAAAAAAAAAAAAAAaGVsbG8udHh0UEsBAhQAFAAAAAgAjyplWD5n4N8lAAAARAIAAA4AAAAAAAAAAAAAAAAANAAAAGRvY3MvcmVhZG1lLm1kUEsBAhQAFAAACAgAjyplWFlR5vcdAAAAGgAAABcAAAAAAAAAAAAAAAAAhQAAAHVuaWNvZGUvbmHDr3ZlLfCfmIAudHh0UEsBAhQAFAAAAAAAjyplWCqG7skHAAAABwAAAA4AAAAAAAAAAAAAAAAA1wAAAHJhdy9zdG9yZWQuYmluUEsFBgAAAAAEAAQA9AAAAAoBAAAAAA=='

/** A structurally valid archive with no entries at all (EOCD record only). */
const EMPTY_ZIP = 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA=='

/**
 * An archive whose entries use codecs fflate cannot inflate: `archive.bz2`
 * (method 12, bzip2) and `exotic.bin` (method 42, not in the APPNOTE table),
 * alongside an ordinary deflate entry. Listing must still succeed.
 */
const MIXED_METHOD_ZIP =
  'UEsDBBQAAAAMAASlFV2MK8vnGgAAABoAAAALAAAAYXJjaGl2ZS5iejJwcmV0ZW5kIHRoaXMgaXMgYnppcDIgZGF0YVBLAwQUAAAAKgAEpRVdf76XriEAAAAhAAAACgAAAGV4b3RpYy5iaW5wcmV0ZW5kIHRoaXMgaXMgc29tZSBmdXR1cmUgY29kZWNQSwMEFAAAAAgABKUVXcr61m0XAAAAFQAAAAkAAABwbGFpbi50eHQryEnMzFNIzEtRSK0oKUpMLklMykkFAFBLAQIUABQAAAAMAASlFV2MK8vnGgAAABoAAAALAAAAAAAAAAAAAAAAAAAAAABhcmNoaXZlLmJ6MlBLAQIUABQAAAAqAASlFV1/vpeuIQAAACEAAAAKAAAAAAAAAAAAAAAAAEMAAABleG90aWMuYmluUEsBAhQAFAAAAAgABKUVXcr61m0XAAAAFQAAAAkAAAAAAAAAAAAAAAAAjAAAAHBsYWluLnR4dFBLBQYAAAAAAwADAKgAAADKAAAAAAA='

/** An archive holding an explicit `folder/` directory entry plus one file. */
const DIR_ZIP =
  'UEsDBBQAAAAIAG+cFV0AAAAAAgAAAAAAAAAHAAAAZm9sZGVyLwMAUEsDBBQAAAAIAG+cFV1DvrfoAwAAAAEAAAAMAAAAZm9sZGVyL2EudHh0SwQAUEsBAhQAFAAAAAgAb5wVXQAAAAACAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAGZvbGRlci9QSwECFAAUAAAACABvnBVdQ7636AMAAAABAAAADAAAAAAAAAAAAAAAAAAnAAAAZm9sZGVyL2EudHh0UEsFBgAAAAACAAIAbwAAAFQAAAAAAA=='

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))

type Entry = { name: string; size: number; compressedSize: number; method: string; directory: boolean }
type Listing = { count: number; totalSize: number; totalCompressedSize: number; entries: Entry[] }

const list = async (archive: Uint8Array) =>
  (await util.apply(archive, {})) as unknown as Listing

describe('zip_list', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('zip_list')
    expect(util.name).toBe('zip list')
    expect(util.category).toBe('Compression')
    expect(util.accepts).toBe('bytes')
    expect(util.produces).toBe('json')
    expect(util.params).toEqual({})
  })

  it('lists every entry in archive order', async () => {
    const out = await list(b64(ZIP))
    expect(out.count).toBe(4)
    expect(out.entries.map((e) => e.name)).toEqual([
      'hello.txt',
      'docs/readme.md',
      'unicode/naïve-😀.txt',
      'raw/stored.bin'
    ])
  })

  it('reports original and compressed sizes plus the compression method', async () => {
    const out = await list(b64(ZIP))
    const hello = out.entries[0]
    expect(hello).toEqual({
      name: 'hello.txt',
      size: 11,
      compressedSize: 13,
      method: 'deflate',
      directory: false
    })
    const stored = out.entries[3]
    expect(stored.method).toBe('stored')
    expect(stored.size).toBe(7)
    expect(stored.compressedSize).toBe(7)
  })

  it('totals the sizes across the archive', async () => {
    const out = await list(b64(ZIP))
    expect(out.totalSize).toBe(624)
    expect(out.totalCompressedSize).toBe(86)
  })

  it('preserves non-ASCII entry names, astral characters included', async () => {
    const out = await list(b64(ZIP))
    const name = out.entries[2].name
    expect(name).toBe('unicode/naïve-😀.txt')
    // code points, not UTF-16 units: the emoji must survive as one character
    expect(Array.from(name)).toContain('😀')
    expect(out.entries[2].size).toBe(26)
  })

  it('flags directory entries', async () => {
    const out = await list(b64(DIR_ZIP))
    expect(out.entries.map((e) => [e.name, e.directory])).toEqual([
      ['folder/', true],
      ['folder/a.txt', false]
    ])
  })

  it('lists entries whose codec cannot be decoded, naming unknown methods', async () => {
    const out = await list(b64(MIXED_METHOD_ZIP))
    expect(out.entries).toEqual([
      { name: 'archive.bz2', size: 26, compressedSize: 26, method: 'bzip2', directory: false },
      { name: 'exotic.bin', size: 33, compressedSize: 33, method: 'method-42', directory: false },
      { name: 'plain.txt', size: 21, compressedSize: 23, method: 'deflate', directory: false }
    ])
    expect(out.totalSize).toBe(80)
  })

  it('never throws on empty input', async () => {
    const out = await list(new Uint8Array(0))
    expect(out).toEqual({ count: 0, totalSize: 0, totalCompressedSize: 0, entries: [] })
    expect(await list('' as unknown as Uint8Array)).toEqual({
      count: 0,
      totalSize: 0,
      totalCompressedSize: 0,
      entries: []
    })
  })

  it('handles an archive with no entries', async () => {
    const out = await list(b64(EMPTY_ZIP))
    expect(out.count).toBe(0)
    expect(out.entries).toEqual([])
  })

  it('throws a clear error on data that is not a ZIP archive', async () => {
    await expect(util.apply(new Uint8Array([1, 2, 3]), {})).rejects.toThrow(
      /Not a valid ZIP archive/
    )
    await expect(util.apply(new TextEncoder().encode('hello world'), {})).rejects.toThrow(
      /Not a valid ZIP archive/
    )
  })
})
