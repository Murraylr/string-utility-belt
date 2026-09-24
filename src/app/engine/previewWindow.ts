import type { Value } from '@/types/utility'
import { isBytes } from '@/core/coerce'

/** "Preview first 64 KB" cuts here. */
export const PREVIEW_LIMIT = 65_536

/** True when the code unit at `end - 1` is a high surrogate that pairs with `end`. */
function splitsSurrogatePair(s: string, end: number): boolean {
  if (end <= 0 || end >= s.length) return false
  const code = s.charCodeAt(end - 1)
  return code >= 0xd800 && code <= 0xdbff
}

export interface PreviewWindow {
  value: Value
  /** True when `value` is a prefix, not the whole input. */
  cut: boolean
}

/**
 * A safe-to-run prefix of `input` for live typing over a large value: at most
 * `PREVIEW_LIMIT` characters (bytes for a `Uint8Array`), cut at the last '\n'
 * inside that window when one exists, and never through a surrogate pair.
 * Non-string, non-bytes input (JSON) is returned whole — there's no meaningful
 * prefix of a parsed value.
 */
export function previewWindow(input: Value): PreviewWindow {
  if (typeof input === 'string') {
    if (input.length <= PREVIEW_LIMIT) return { value: input, cut: false }
    let end = PREVIEW_LIMIT
    if (splitsSurrogatePair(input, end)) end -= 1
    const nl = input.lastIndexOf('\n', end - 1)
    // cut AT the newline (dropping it): whole lines, with no phantom empty last line
    // for line-oriented steps such as sort/number/count lines
    return { value: input.slice(0, nl === -1 ? end : nl), cut: true }
  }
  if (isBytes(input)) {
    const bytes = input as Uint8Array
    if (bytes.length <= PREVIEW_LIMIT) return { value: input, cut: false }
    return { value: bytes.slice(0, PREVIEW_LIMIT), cut: true }
  }
  return { value: input, cut: false }
}
