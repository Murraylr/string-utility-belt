/** Small byte<->text helpers shared across the io feature (hex/base64 views, copy-as, sniffing). */

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0')
  return out
}

/** btoa() only accepts Latin-1; chunk through String.fromCharCode to avoid a call-stack blowup on large inputs. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function utf8Encode(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

/**
 * Strict UTF-8 decode; null on any invalid byte sequence rather than inserting U+FFFD.
 * A leading BOM is kept (`ignoreBOM`): this is a string tool, and silently dropping it would
 * hide exactly what a BOM-detecting step is looking for.
 */
export function tryDecodeUtf8Strict(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    return null
  }
}

/** Lossy UTF-8 decode: invalid sequences become U+FFFD instead of throwing. */
export function decodeUtf8Lossy(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(bytes)
}

/**
 * Lossy decode of at most `max` leading bytes. The cut is decoded in streaming mode, so a
 * multi-byte character split by it is dropped rather than shown as a stray U+FFFD.
 */
export function decodeUtf8Prefix(bytes: Uint8Array, max: number): string {
  if (bytes.length <= max) return decodeUtf8Lossy(bytes)
  return new TextDecoder('utf-8', { fatal: false, ignoreBOM: true }).decode(bytes.subarray(0, max), { stream: true })
}

/** C0 controls that plain text does not contain (everything below 0x20 except \t \n \v \f \r and ESC). */
const isBinaryControl = (b: number) => b < 0x20 && !(b >= 0x09 && b <= 0x0d) && b !== 0x1b

/**
 * Whether bytes read as text: the first `probe` bytes are strict UTF-8 with no NUL or other
 * binary control bytes. Only the head is checked, so this stays cheap for any size.
 */
export function looksLikeText(bytes: Uint8Array, probe = 64 * 1024): boolean {
  const head = bytes.subarray(0, probe)
  for (let i = 0; i < head.length; i++) if (isBinaryControl(head[i])) return false
  try {
    // streaming: a character cut by the probe edge is incomplete, not invalid
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: head.length < bytes.length })
    return true
  } catch {
    return false
  }
}
