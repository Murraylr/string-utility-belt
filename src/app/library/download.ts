/**
 * Hand the viewer a text file. The anchor is attached before clicking (Firefox
 * ignores clicks on detached anchors) and the blob URL is revoked on a later tick:
 * revoking synchronously can cancel the download before the browser has read it.
 */
export function downloadText(filename: string, contents: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  try {
    a.click()
  } finally {
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

/** A filename-safe version of a user-supplied name (keeps letters of any script). */
export function safeFilename(name: string, fallback = 'pipeline'): string {
  const cleaned = name.normalize('NFC').replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 80)
  return cleaned || fallback
}
