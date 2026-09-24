/**
 * Share-link decoding with a ceiling on the decompressed size. The bounded decoder
 * lives in core (every host decodes untrusted links through it); this module keeps
 * the worker's names.
 */
import { decodeShare } from '../src/core/serialize'
import { decompressUriSafe, ShareTooLargeError } from '../src/core/lzBounded'
import type { PipelineDoc } from '../src/types/utility'

export { decompressUriSafe, ShareTooLargeError }

/** `decodeShare` with an explicit ceiling; throws ShareTooLargeError past it. */
export const decodeShareBounded = (encoded: string, maxChars: number): PipelineDoc => decodeShare(encoded, maxChars)
