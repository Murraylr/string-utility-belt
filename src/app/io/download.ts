import { isBytes, valueType } from '@/core/coerce'
import type { Value } from '@/types/utility'
import { looksLikeCsv, looksLikeHtml, looksLikeMarkdown, looksLikeXml, parsesAsJson } from './textHeuristics'

export interface DownloadPlan {
  filename: string
  mime: string
  /** Raw bytes for a bytes value, otherwise the formatted text. */
  data: BlobPart
}

const MAGIC_SNIFFERS: Array<{ ext: string; mime: string; magic: (b: Uint8Array) => boolean }> = [
  { ext: 'png', mime: 'image/png', magic: b => match(b, [0x89, 0x50, 0x4e, 0x47]) },
  { ext: 'jpg', mime: 'image/jpeg', magic: b => match(b, [0xff, 0xd8, 0xff]) },
  { ext: 'gif', mime: 'image/gif', magic: b => match(b, [0x47, 0x49, 0x46, 0x38]) },
  { ext: 'pdf', mime: 'application/pdf', magic: b => match(b, [0x25, 0x50, 0x44, 0x46]) },
  {
    ext: 'zip',
    mime: 'application/zip',
    magic: b => match(b, [0x50, 0x4b, 0x03, 0x04]) || match(b, [0x50, 0x4b, 0x05, 0x06]) || match(b, [0x50, 0x4b, 0x07, 0x08]),
  },
  { ext: 'gz', mime: 'application/gzip', magic: b => match(b, [0x1f, 0x8b]) },
  { ext: 'wasm', mime: 'application/wasm', magic: b => match(b, [0x00, 0x61, 0x73, 0x6d]) },
]

function match(bytes: Uint8Array, magic: number[]): boolean {
  if (bytes.length < magic.length) return false
  for (let i = 0; i < magic.length; i++) if (bytes[i] !== magic[i]) return false
  return true
}

export function sniffBytesExtension(bytes: Uint8Array): { ext: string; mime: string } {
  for (const s of MAGIC_SNIFFERS) if (s.magic(bytes)) return { ext: s.ext, mime: s.mime }
  return { ext: 'bin', mime: 'application/octet-stream' }
}

/** Same slugification as the `slug` utility (kept local: no cross-feature dependency), capped at 80 chars. */
export function slugifyBaseName(name: string | undefined): string {
  const slug = (name ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .toLowerCase()
    .slice(0, 80)
    .replace(/^-+|-+$/g, '')
  return slug || 'result'
}

/** Decide a filename, MIME type and payload for downloading the pipeline's current output. */
export function pickDownload(value: Value, baseName?: string): DownloadPlan {
  const base = slugifyBaseName(baseName)

  if (isBytes(value)) {
    const { ext, mime } = sniffBytesExtension(value)
    return { filename: `${base}.${ext}`, mime, data: value.slice() as BlobPart }
  }

  if (valueType(value) === 'json') {
    return { filename: `${base}.json`, mime: 'application/json', data: JSON.stringify(value, null, 2) }
  }

  const text = String(value ?? '')
  if (parsesAsJson(text)) return { filename: `${base}.json`, mime: 'application/json', data: text }
  // html before xml: an <html> document also satisfies the xml root-element heuristic
  if (looksLikeHtml(text)) return { filename: `${base}.html`, mime: 'text/html;charset=utf-8', data: text }
  if (looksLikeXml(text)) return { filename: `${base}.xml`, mime: 'application/xml', data: text }
  if (looksLikeCsv(text)) return { filename: `${base}.csv`, mime: 'text/csv;charset=utf-8', data: text }
  if (looksLikeMarkdown(text)) return { filename: `${base}.md`, mime: 'text/markdown;charset=utf-8', data: text }
  return { filename: `${base}.txt`, mime: 'text/plain;charset=utf-8', data: text }
}

/** How long the object URL outlives the click; revoking at once can cancel the download in some browsers. */
const REVOKE_AFTER_MS = 30_000

/** Builds the Blob and triggers a browser download through a temporary, attached link. */
export function triggerDownload(plan: DownloadPlan): void {
  const blob = new Blob([plan.data], { type: plan.mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = plan.filename
  a.rel = 'noopener'
  a.style.display = 'none'
  // Firefox ignores click() on a link that is not in the document
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS)
  }
}
