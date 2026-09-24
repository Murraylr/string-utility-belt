import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

// Cached dynamic import — the pipeline re-runs on every keystroke, and a
// top-level static import would drag fflate into the initial bundle.
let _fflate: typeof import('fflate') | null = null
const getFflate = async () => (_fflate ??= await import('fflate'))

type ZipEntryInfo = { name: string; compression: number; directory: boolean }

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

/** Read the central directory without inflating anything. */
const listEntries = async (bytes: Uint8Array): Promise<ZipEntryInfo[]> => {
  const { unzipSync } = await getFflate()
  const entries: ZipEntryInfo[] = []
  try {
    unzipSync(bytes, {
      filter: (file) => {
        entries.push({
          name: file.name,
          compression: file.compression,
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

const basename = (name: string): string => {
  const trimmed = name.endsWith('/') ? name.slice(0, -1) : name
  const i = trimmed.lastIndexOf('/')
  return i === -1 ? trimmed : trimmed.slice(i + 1)
}

const describeAvailable = (entries: ZipEntryInfo[]): string => {
  const names = entries.map((e) => e.name)
  const shown = names.slice(0, 20).map((n) => `"${n}"`).join(', ')
  const extra = names.length > 20 ? `, +${names.length - 20} more` : ''
  return `${shown}${extra}`
}

/**
 * Resolve the user's `entry` string to an actual archive entry. Exact match
 * wins; we then fall back to leading-`./` tolerance, case-insensitive match and
 * finally an unambiguous basename match, so "readme.md" finds "docs/readme.md".
 */
export const resolveEntry = (entries: ZipEntryInfo[], wanted: string): ZipEntryInfo => {
  const target = wanted.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '')

  if (target === '') {
    const first = entries.find((e) => !e.directory)
    if (!first) {
      throw new Error('ZIP archive contains no files (only directory entries)')
    }
    return first
  }

  const normalize = (name: string) => name.replace(/^\.\//, '').replace(/^\//, '')
  const exact = entries.find((e) => normalize(e.name) === target)
  if (exact) return exact

  const lower = target.toLowerCase()
  const insensitive = entries.filter((e) => normalize(e.name).toLowerCase() === lower)
  if (insensitive.length === 1) return insensitive[0]

  const byBase = entries.filter((e) => !e.directory && basename(e.name).toLowerCase() === lower)
  if (byBase.length === 1) return byBase[0]
  if (byBase.length > 1) {
    throw new Error(
      `Entry "${wanted}" is ambiguous — it matches ${byBase.map((e) => `"${e.name}"`).join(', ')}`
    )
  }

  throw new Error(
    `Entry "${wanted}" not found in the archive. Available entries: ${describeAvailable(entries)}`
  )
}

const util: Utility = {
  id: 'zip_extract',
  name: 'zip extract',
  category: 'Compression',
  description:
    'Extract a single entry from a ZIP archive by name (blank picks the first file) as text or raw bytes.',
  accepts: 'bytes',
  produces: ['string', 'bytes'],
  tags: ['zip', 'extract', 'archive', 'unzip', 'file', 'entry'],
  examples: [
    {
      title: 'extract a named entry as text',
      input:
        '504b030414000000080039a9375df083a9ec0d0000000b0000000900000068656c6c6f2e747874f348cdc9c9d75188f20c500400504b030414000000080039a9375dcfbe36e00b000000090000000e000000646f63732f726561646d652e6d645356084a4d4cc94de50200504b0102140014000000080039a9375df083a9ec0d0000000b00000009000000000000000000000000000000000068656c6c6f2e747874504b0102140014000000080039a9375dcfbe36e00b000000090000000e0000000000000000000000000034000000646f63732f726561646d652e6d64504b05060000000002000200730000006b0000000000',
      inputEncoding: 'hex',
      params: { entry: 'hello.txt', output: 'text' },
      output: 'Hello, ZIP!'
    }
  ],
  params: {
    entry: {
      kind: 'string',
      label: 'entry',
      default: '',
      placeholder: 'path/inside.zip — blank = first file'
    },
    output: {
      kind: 'select',
      label: 'output',
      options: ['text', 'bytes'],
      default: 'text'
    }
  },
  async apply(input: any, params: any) {
    const output = params?.output === 'bytes' ? 'bytes' : 'text'
    const wanted = params?.entry == null ? '' : String(params.entry)
    const bytes = toBytes(input)
    if (bytes.length === 0) return output === 'bytes' ? new Uint8Array(0) : ''

    const entries = await listEntries(bytes)
    if (entries.length === 0) throw new Error('ZIP archive contains no entries')

    const target = resolveEntry(entries, wanted)
    if (target.directory) {
      throw new Error(`Entry "${target.name}" is a directory, not a file`)
    }
    if (target.compression !== 0 && target.compression !== 8) {
      throw new Error(
        `Cannot extract "${target.name}": unsupported compression method ${target.compression} (only stored and deflate are supported)`
      )
    }

    const { unzipSync } = await getFflate()
    let data: Uint8Array | undefined
    try {
      data = unzipSync(bytes, { filter: (file) => file.name === target.name })[target.name]
    } catch (e) {
      throw new Error(`Could not extract "${target.name}": ${errorMessage(e)}`)
    }
    if (!data) throw new Error(`Could not extract "${target.name}" from the archive`)

    if (output === 'bytes') return data
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(data)
    } catch {
      throw new Error(
        `Entry "${target.name}" is not valid UTF-8 text — set output to "bytes".`
      )
    }
  }
}

export default util
