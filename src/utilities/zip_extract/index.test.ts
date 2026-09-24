import { describe, it, expect } from 'vitest'
import util from './index'

/**
 * A real ZIP archive containing:
 *   hello.txt            (deflate)  "Hello, ZIP!"
 *   docs/readme.md       (deflate)  580 bytes of repeated markdown
 *   unicode/naïve-😀.txt (deflate)  "héllo wörld — 😀 ✓"
 *   raw/stored.bin       (stored)   bytes 00 01 02 03 FF FE FD
 */
const ZIP =
  'UEsDBBQAAAAIAI8qZVjwg6nsDQAAAAsAAAAJAAAAaGVsbG8udHh080jNycnXUYjyDFAEAFBLAwQUAAAACACPKmVYPmfg3yUAAABEAgAADgAAAGRvY3MvcmVhZG1lLm1kU1YIySzJSeXiCs7PTVUoSa0oUShKLUhNLElN0VMYlRyVJEISAFBLAwQUAAAICACPKmVYWVHm9x0AAAAaAAAAFwAAAHVuaWNvZGUvbmHDr3ZlLfCfmIAudHh0yzi8MicnX6H88LainBSFRw1TFD7Mn9Gg8GjOZABQSwMEFAAAAAAAjyplWCqG7skHAAAABwAAAA4AAAByYXcvc3RvcmVkLmJpbgABAgP//v1QSwECFAAUAAAACACPKmVY8IOp7A0AAAALAAAACQAAAAAAAAAAAAAAAAAAAAAAaGVsbG8udHh0UEsBAhQAFAAAAAgAjyplWD5n4N8lAAAARAIAAA4AAAAAAAAAAAAAAAAANAAAAGRvY3MvcmVhZG1lLm1kUEsBAhQAFAAACAgAjyplWFlR5vcdAAAAGgAAABcAAAAAAAAAAAAAAAAAhQAAAHVuaWNvZGUvbmHDr3ZlLfCfmIAudHh0UEsBAhQAFAAAAAAAjyplWCqG7skHAAAABwAAAA4AAAAAAAAAAAAAAAAA1wAAAHJhdy9zdG9yZWQuYmluUEsFBgAAAAAEAAQA9AAAAAoBAAAAAA=='

/** A structurally valid archive with no entries at all (EOCD record only). */
const EMPTY_ZIP = 'UEsFBgAAAAAAAAAAAAAAAAAAAAAAAA=='

/** An archive holding an explicit `folder/` directory entry plus one file. */
const DIR_ZIP =
  'UEsDBBQAAAAIAG+cFV0AAAAAAgAAAAAAAAAHAAAAZm9sZGVyLwMAUEsDBBQAAAAIAG+cFV1DvrfoAwAAAAEAAAAMAAAAZm9sZGVyL2EudHh0SwQAUEsBAhQAFAAAAAgAb5wVXQAAAAACAAAAAAAAAAcAAAAAAAAAAAAAAAAAAAAAAGZvbGRlci9QSwECFAAUAAAACABvnBVdQ7636AMAAAABAAAADAAAAAAAAAAAAAAAAAAnAAAAZm9sZGVyL2EudHh0UEsFBgAAAAACAAIAbwAAAFQAAAAAAA=='

/** `archive.bz2` is method 12 (bzip2) and `exotic.bin` method 42; `plain.txt` is deflate. */
const MIXED_METHOD_ZIP =
  'UEsDBBQAAAAMAASlFV2MK8vnGgAAABoAAAALAAAAYXJjaGl2ZS5iejJwcmV0ZW5kIHRoaXMgaXMgYnppcDIgZGF0YVBLAwQUAAAAKgAEpRVdf76XriEAAAAhAAAACgAAAGV4b3RpYy5iaW5wcmV0ZW5kIHRoaXMgaXMgc29tZSBmdXR1cmUgY29kZWNQSwMEFAAAAAgABKUVXcr61m0XAAAAFQAAAAkAAABwbGFpbi50eHQryEnMzFNIzEtRSK0oKUpMLklMykkFAFBLAQIUABQAAAAMAASlFV2MK8vnGgAAABoAAAALAAAAAAAAAAAAAAAAAAAAAABhcmNoaXZlLmJ6MlBLAQIUABQAAAAqAASlFV1/vpeuIQAAACEAAAAKAAAAAAAAAAAAAAAAAEMAAABleG90aWMuYmluUEsBAhQAFAAAAAgABKUVXcr61m0XAAAAFQAAAAkAAAAAAAAAAAAAAAAAjAAAAHBsYWluLnR4dFBLBQYAAAAAAwADAKgAAADKAAAAAAA='

/** `A.txt` ("upper"), `a.txt` ("lower") and `sub/a.txt` ("sub") — deliberately ambiguous. */
const CASE_ZIP =
  'UEsDBBQAAAAIADajFV2c319uBwAAAAUAAAAFAAAAQS50eHQrLShILQIAUEsDBBQAAAAIADajFV0je5oOBwAAAAUAAAAFAAAAYS50eHTLyS9PLQIAUEsDBBQAAAAIADajFV3cggJYBQAAAAMAAAAJAAAAc3ViL2EudHh0Ky5NAgBQSwECFAAUAAAACAA2oxVdnN9fbgcAAAAFAAAABQAAAAAAAAAAAAAAAAAAAAAAQS50eHRQSwECFAAUAAAACAA2oxVdI3uaDgcAAAAFAAAABQAAAAAAAAAAAAAAAAAqAAAAYS50eHRQSwECFAAUAAAACAA2oxVd3IICWAUAAAADAAAACQAAAAAAAAAAAAAAAABUAAAAc3ViL2EudHh0UEsFBgAAAAADAAMAnQAAAIAAAAAAAA=='

/** `empty.txt` is a zero-byte deflate entry; `dup.txt` holds "first". */
const EMPTY_FILE_ZIP =
  'UEsDBBQAAAAIADajFV0AAAAAAgAAAAAAAAAJAAAAZW1wdHkudHh0AwBQSwMEFAAAAAgANqMVXVfucZIHAAAABQAAAAcAAABkdXAudHh0S8ssKi4BAFBLAQIUABQAAAAIADajFV0AAAAAAgAAAAAAAAAJAAAAAAAAAAAAAAAAAAAAAABlbXB0eS50eHRQSwECFAAUAAAACAA2oxVdV+5xkgcAAAAFAAAABwAAAAAAAAAAAAAAAAApAAAAZHVwLnR4dFBLBQYAAAAAAgACAGwAAABVAAAAAAA='

/** An archive holding nothing but directory entries. */
const DIRS_ONLY_ZIP =
  'UEsDBBQAAAAIAASlFV0AAAAAAgAAAAAAAAAFAAAAb25seS8DAFBLAwQUAAAACAAEpRVdAAAAAAIAAAAAAAAADAAAAG9ubHkvZGVlcGVyLwMAUEsBAhQAFAAAAAgABKUVXQAAAAACAAAAAAAAAAUAAAAAAAAAAAAAAAAAAAAAAG9ubHkvUEsBAhQAFAAAAAgABKUVXQAAAAACAAAAAAAAAAwAAAAAAAAAAAAAAAAAJQAAAG9ubHkvZGVlcGVyL1BLBQYAAAAAAgACAG0AAABRAAAAAAA='

const b64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const README = '# Title\n\nSome text repeated. '.repeat(20)

describe('zip_extract', () => {
  it('has correct metadata', () => {
    expect(util.id).toBe('zip_extract')
    expect(util.name).toBe('zip extract')
    expect(util.category).toBe('Compression')
    expect(util.accepts).toBe('bytes')
    expect(util.produces).toEqual(['string', 'bytes'])
    expect(Object.keys(util.params)).toEqual(['entry', 'output'])
    expect(util.params.output).toMatchObject({ options: ['text', 'bytes'], default: 'text' })
  })

  it('extracts the first file when no entry is given', async () => {
    expect(await util.apply(b64(ZIP), {})).toBe('Hello, ZIP!')
    expect(await util.apply(b64(ZIP), { entry: '' })).toBe('Hello, ZIP!')
  })

  it('extracts a named entry, including nested paths', async () => {
    expect(await util.apply(b64(ZIP), { entry: 'docs/readme.md' })).toBe(README)
    expect(await util.apply(b64(ZIP), { entry: './docs/readme.md' })).toBe(README)
  })

  it('extracts entries with non-ASCII names and content', async () => {
    const out = (await util.apply(b64(ZIP), { entry: 'unicode/naïve-😀.txt' })) as string
    expect(out).toBe('héllo wörld — 😀 ✓')
    // code points, not UTF-16 units: the emoji must survive as one character
    expect(Array.from(out)).toContain('😀')
    expect(Array.from(out).length).toBe(17)
  })

  it('returns raw bytes when output is bytes', async () => {
    const out = await util.apply(b64(ZIP), { entry: 'raw/stored.bin', output: 'bytes' })
    expect(out).toBeInstanceOf(Uint8Array)
    expect(Array.from(out as Uint8Array)).toEqual([0, 1, 2, 3, 255, 254, 253])
    const text = await util.apply(b64(ZIP), { entry: 'hello.txt', output: 'text' })
    expect(text).toBe('Hello, ZIP!')
  })

  it('refuses to mangle binary entries into text', async () => {
    await expect(
      util.apply(b64(ZIP), { entry: 'raw/stored.bin', output: 'text' })
    ).rejects.toThrow(/not valid UTF-8/i)
  })

  it('falls back to case-insensitive and basename matching', async () => {
    expect(await util.apply(b64(ZIP), { entry: 'HELLO.TXT' })).toBe('Hello, ZIP!')
    expect(await util.apply(b64(ZIP), { entry: 'readme.md' })).toBe(README)
  })

  it('throws a helpful error when the entry is missing', async () => {
    await expect(util.apply(b64(ZIP), { entry: 'nope.txt' })).rejects.toThrow(
      /not found in the archive.*hello\.txt/s
    )
  })

  it('refuses entries compressed with a codec it cannot inflate', async () => {
    await expect(
      util.apply(b64(MIXED_METHOD_ZIP), { entry: 'archive.bz2' })
    ).rejects.toThrow(/unsupported compression method 12/)
    await expect(util.apply(b64(MIXED_METHOD_ZIP), { entry: 'exotic.bin' })).rejects.toThrow(
      /unsupported compression method 42/
    )
    // the deflate entry in the same archive still comes out intact
    expect(await util.apply(b64(MIXED_METHOD_ZIP), { entry: 'plain.txt' })).toBe(
      'plain and extractable'
    )
  })

  it('reports an ambiguous name instead of guessing', async () => {
    await expect(util.apply(b64(CASE_ZIP), { entry: 'A.TXT' })).rejects.toThrow(
      /ambiguous.*"A\.txt".*"a\.txt".*"sub\/a\.txt"/s
    )
    // an exact match is never ambiguous, even when siblings differ only by case
    expect(await util.apply(b64(CASE_ZIP), { entry: 'a.txt' })).toBe('lower')
    expect(await util.apply(b64(CASE_ZIP), { entry: 'A.txt' })).toBe('upper')
    expect(await util.apply(b64(CASE_ZIP), { entry: 'sub/a.txt' })).toBe('sub')
  })

  it('extracts a zero-byte entry as an empty result, not an error', async () => {
    expect(await util.apply(b64(EMPTY_FILE_ZIP), { entry: 'empty.txt' })).toBe('')
    const bytes = await util.apply(b64(EMPTY_FILE_ZIP), {
      entry: 'empty.txt',
      output: 'bytes'
    })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect((bytes as Uint8Array).length).toBe(0)
  })

  it('refuses directory entries and empty archives', async () => {
    await expect(util.apply(b64(DIR_ZIP), { entry: 'folder/' })).rejects.toThrow(
      /is a directory/
    )
    await expect(util.apply(b64(EMPTY_ZIP), {})).rejects.toThrow(/no entries/)
    await expect(util.apply(b64(DIRS_ONLY_ZIP), {})).rejects.toThrow(
      /contains no files \(only directory entries\)/
    )
  })

  it('never throws on empty input', async () => {
    expect(await util.apply(new Uint8Array(0), {})).toBe('')
    expect(await util.apply('', { entry: 'whatever' })).toBe('')
    const bytes = await util.apply(new Uint8Array(0), { output: 'bytes' })
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect((bytes as Uint8Array).length).toBe(0)
  })

  it('throws a clear error on data that is not a ZIP archive', async () => {
    await expect(util.apply(new Uint8Array([1, 2, 3]), {})).rejects.toThrow(
      /Not a valid ZIP archive/
    )
  })
})
