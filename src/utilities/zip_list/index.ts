import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

// Cached dynamic import — the pipeline re-runs on every keystroke, and a
// top-level static import would drag fflate into the initial bundle.
let _fflate: typeof import('fflate') | null = null
const getFflate = async () => (_fflate ??= await import('fflate'))

type ZipEntry = {
  name: string
  size: number
  compressedSize: number
  method: string
  directory: boolean
}

/** PKZIP APPNOTE.txt §4.4.5 compression methods. */
const METHODS: Record<number, string> = {
  0: 'stored',
  1: 'shrunk',
  2: 'reduced-1',
  3: 'reduced-2',
  4: 'reduced-3',
  5: 'reduced-4',
  6: 'imploded',
  8: 'deflate',
  9: 'deflate64',
  12: 'bzip2',
  14: 'lzma',
  93: 'zstd',
  95: 'xz',
  96: 'jpeg',
  97: 'wavpack',
  98: 'ppmd',
  99: 'aes'
}

const errorMessage = (e: unknown): string =>
  e instanceof Error ? e.message : String(e)

/** Accept real bytes, array-buffer views, or a binary/UTF-8 string. */
const toBytes = (input: unknown): Uint8Array => {
  if (isBytes(input)) return input
  if (input instanceof ArrayBuffer) return new Uint8Array(input)
  if (ArrayBuffer.isView(input)) {
    const view = input as ArrayBufferView
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
  }
  const s = input == null ? '' : String(input)
  // A binary string (every code unit <= 0xFF, e.g. the result of atob) maps 1:1 to bytes.
  let binary = true
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0xff) { binary = false; break }
  }
  if (binary) {
    const out = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
    return out
  }
  return new TextEncoder().encode(s)
}

/**
 * Walk the archive's central directory via fflate's `unzipSync` filter hook.
 * Returning `false` from the filter means nothing is actually inflated, so
 * listing stays cheap and works even for entries using a codec fflate cannot
 * decode (it only throws for unsupported methods it is asked to extract).
 */
export const listZipEntries = async (bytes: Uint8Array): Promise<ZipEntry[]> => {
  const { unzipSync } = await getFflate()
  const entries: ZipEntry[] = []
  try {
    unzipSync(bytes, {
      filter: (file) => {
        entries.push({
          name: file.name,
          size: file.originalSize,
          compressedSize: file.size,
          method: METHODS[file.compression] ?? `method-${file.compression}`,
          directory: file.name.endsWith('/')
        })
        return false
      }
    })
  } catch (e) {
    throw new Error(`Not a valid ZIP archive: ${errorMessage(e)}`)
  }
  return entries
}

const util: Utility = {
  id: 'zip_list',
  name: 'zip list',
  category: 'Compression',
  description:
    'List every entry in a ZIP archive with its original size, compressed size and compression method.',
  accepts: 'bytes',
  produces: 'json',
  tags: ['zip', 'list', 'archive', 'unzip', 'inventory', 'entries'],
  examples: [
    {
      title: 'list a two-file archive',
      input:
        '504b030414000000080039a9375df083a9ec0d0000000b0000000900000068656c6c6f2e747874f348cdc9c9d75188f20c500400504b030414000000080039a9375dcfbe36e00b000000090000000e000000646f63732f726561646d652e6d645356084a4d4cc94de50200504b0102140014000000080039a9375df083a9ec0d0000000b00000009000000000000000000000000000000000068656c6c6f2e747874504b0102140014000000080039a9375dcfbe36e00b000000090000000e0000000000000000000000000034000000646f63732f726561646d652e6d64504b05060000000002000200730000006b0000000000',
      inputEncoding: 'hex',
      output:
        '{\n  "count": 2,\n  "totalSize": 20,\n  "totalCompressedSize": 24,\n  "entries": [\n    {\n      "name": "hello.txt",\n      "size": 11,\n      "compressedSize": 13,\n      "method": "deflate",\n      "directory": false\n    },\n    {\n      "name": "docs/readme.md",\n      "size": 9,\n      "compressedSize": 11,\n      "method": "deflate",\n      "directory": false\n    }\n  ]\n}'
    }
  ],
  params: {},
  async apply(input: any) {
    const bytes = toBytes(input)
    if (bytes.length === 0) {
      return { count: 0, totalSize: 0, totalCompressedSize: 0, entries: [] }
    }
    const entries = await listZipEntries(bytes)
    let totalSize = 0
    let totalCompressedSize = 0
    for (const entry of entries) {
      totalSize += entry.size
      totalCompressedSize += entry.compressedSize
    }
    return { count: entries.length, totalSize, totalCompressedSize, entries }
  }
}

export default util
