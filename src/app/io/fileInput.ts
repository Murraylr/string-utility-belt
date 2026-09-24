import { tryDecodeUtf8Strict } from './bytes'

export const MAX_TEXT_PROBE_BYTES = 5 * 1024 * 1024

export interface FileInputMeta {
  name: string
  size: number
  mime: string
}

export type FileInputResult =
  | { kind: 'text'; value: string; meta: FileInputMeta }
  | { kind: 'binary'; value: Uint8Array; meta: FileInputMeta }

/** Reads a File/Blob as an ArrayBuffer via FileReader — works in every target, including jsdom, where Blob#arrayBuffer is not implemented. */
function readAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error ?? new Error('failed to read file'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Reads a File/Blob for use as pipeline input. A file up to 5 MB that decodes as strict
 * UTF-8 becomes a string input; everything else (bigger, or not valid UTF-8) stays Uint8Array,
 * regardless of its reported MIME type — a mislabelled binary file must not corrupt the pipeline.
 */
export async function readFileAsInput(file: File): Promise<FileInputResult> {
  const buf = await readAsArrayBuffer(file)
  const bytes = new Uint8Array(buf)
  const meta: FileInputMeta = { name: file.name, size: bytes.length, mime: file.type || '' }

  if (bytes.length <= MAX_TEXT_PROBE_BYTES) {
    const decoded = tryDecodeUtf8Strict(bytes)
    if (decoded !== null) return { kind: 'text', value: decoded, meta }
  }
  return { kind: 'binary', value: bytes, meta }
}
