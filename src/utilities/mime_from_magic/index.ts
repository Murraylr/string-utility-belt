import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

type Match = {
  mime: string
  extension: string
  description: string
  confidence: number
}

const UNKNOWN: Match = {
  mime: 'application/octet-stream',
  extension: '',
  description: 'unrecognised binary data',
  confidence: 0
}

const hit = (mime: string, extension: string, description: string, confidence = 1): Match => ({
  mime,
  extension,
  description,
  confidence
})

/** Read `len` bytes at `at` as latin-1 so signatures can be compared as plain strings. */
const ascii = (b: Uint8Array, at: number, len: number): string => {
  let out = ''
  for (let i = at; i < at + len && i < b.length; i++) out += String.fromCharCode(b[i])
  return out
}

const startsWith = (b: Uint8Array, sig: number[]): boolean => {
  if (b.length < sig.length) return false
  for (let i = 0; i < sig.length; i++) if (b[i] !== sig[i]) return false
  return true
}

/** Little-endian uint32, used for the ZIP and PE header fields. */
const u32le = (b: Uint8Array, at: number): number =>
  ((b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0)

const u16le = (b: Uint8Array, at: number): number => b[at] | (b[at + 1] << 8)

/** ISO base media file format: the brand at offset 8 decides the real type. */
const sniffIsoBmff = (b: Uint8Array): Match => {
  const brand = ascii(b, 8, 4).trim().toLowerCase()
  // 3GPP/3GPP2 ship a whole family of brands (3gp1..3gp9, 3ge6, 3g2a, ...).
  if (/^3g[ep]\d$/.test(brand)) return hit('video/3gpp', '3gp', '3GPP video', 1)
  if (/^3g2\w?$/.test(brand)) return hit('video/3gpp2', '3g2', '3GPP2 video', 1)
  switch (brand) {
    case 'avif':
    case 'avis':
      return hit('image/avif', 'avif', 'AVIF image', 1)
    case 'heic':
    case 'heix':
    case 'hevc':
    case 'heim':
    case 'heis':
      return hit('image/heic', 'heic', 'HEIC image', 1)
    case 'mif1':
    case 'msf1':
      return hit('image/heif', 'heif', 'HEIF image', 1)
    case 'qt':
      return hit('video/quicktime', 'mov', 'QuickTime movie', 1)
    case 'm4a':
      return hit('audio/mp4', 'm4a', 'MPEG-4 audio', 1)
    case 'm4b':
      return hit('audio/mp4', 'm4b', 'MPEG-4 audiobook', 1)
    case 'm4v':
      return hit('video/x-m4v', 'm4v', 'MPEG-4 video (iTunes)', 1)
    case 'crx':
      return hit('image/x-canon-cr3', 'cr3', 'Canon CR3 raw image', 0.9)
    default:
      return hit('video/mp4', 'mp4', `MPEG-4 container (brand "${brand || 'unknown'}")`, 0.95)
  }
}

/** ZIP is a container: look at the first entry (and any filenames we can see) to refine it. */
const sniffZip = (b: Uint8Array): Match => {
  // One pass over the leading bytes; the entry names of a ZIP are stored uncompressed
  // in each local file header, so a plain substring search over them is enough.
  const head = ascii(b, 0, Math.min(b.length, 65536))
  const method = u16le(b, 8)
  const nameLength = u16le(b, 26)
  const extraLength = u16le(b, 28)
  // EPUB/ODF put an uncompressed "mimetype" entry first. Its payload starts after the
  // name *and* the extra field — assuming a fixed offset of 38 misses any archive that
  // carries an extra field on that entry.
  if (method === 0 && nameLength === 8 && head.slice(30, 38) === 'mimetype') {
    const at = 30 + nameLength + extraLength
    const declared = head.slice(at, at + 96).match(/^[a-z]+\/[a-z0-9.+-]+/)
    const mime = declared ? declared[0] : ''
    const odf: Record<string, [string, string]> = {
      'application/epub+zip': ['epub', 'EPUB e-book'],
      'application/vnd.oasis.opendocument.text': ['odt', 'OpenDocument text'],
      'application/vnd.oasis.opendocument.spreadsheet': ['ods', 'OpenDocument spreadsheet'],
      'application/vnd.oasis.opendocument.presentation': ['odp', 'OpenDocument presentation'],
      'application/vnd.oasis.opendocument.graphics': ['odg', 'OpenDocument graphics']
    }
    if (mime && odf[mime]) return hit(mime, odf[mime][0], odf[mime][1], 1)
    if (mime) return hit(mime, '', `ZIP container declaring ${mime}`, 0.8)
  }
  if (head.includes('word/document.xml'))
    return hit(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'docx',
      'Word (OOXML) document',
      0.85
    )
  if (head.includes('xl/workbook.xml'))
    return hit(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xlsx',
      'Excel (OOXML) workbook',
      0.85
    )
  if (head.includes('ppt/presentation.xml'))
    return hit(
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'pptx',
      'PowerPoint (OOXML) presentation',
      0.85
    )
  if (head.includes('AndroidManifest.xml'))
    return hit('application/vnd.android.package-archive', 'apk', 'Android package', 0.85)
  if (head.includes('META-INF/MANIFEST.MF'))
    return hit('application/java-archive', 'jar', 'Java archive', 0.85)
  return hit('application/zip', 'zip', 'ZIP archive', 0.95)
}

/**
 * "MZ" on its own is two ordinary letters. Believe it only when the DOS header is
 * followed by a real PE signature, or at least looks like a binary header (a text file
 * never has NUL padding in its first 64 bytes).
 */
const sniffMz = (b: Uint8Array): Match | null => {
  if (b.length < 0x40) return null
  const peAt = u32le(b, 0x3c)
  if (peAt >= 0x40 && peAt + 4 <= b.length && startsWith(b.subarray(peAt), [0x50, 0x45, 0x00, 0x00]))
    return hit('application/vnd.microsoft.portable-executable', 'exe', 'Windows PE executable', 1)
  for (let i = 2; i < 0x40; i++) {
    if (b[i] === 0)
      return hit('application/vnd.microsoft.portable-executable', 'exe', 'DOS/Windows executable (MZ)', 0.8)
  }
  return null
}

/**
 * A valid MPEG audio frame header is 11 sync bits followed by fields that must not use
 * their reserved values — without those checks any byte pair like `FF FE` (a UTF-16
 * byte-order mark) reads as an MP3.
 */
const isMpegAudioFrame = (b: Uint8Array): boolean => {
  if (b.length < 4 || b[0] !== 0xff || (b[1] & 0xe0) !== 0xe0) return false
  const version = (b[1] >> 3) & 0x03 // 01 reserved
  const layer = (b[1] >> 1) & 0x03 // 00 reserved
  const bitrate = (b[2] >> 4) & 0x0f // 0000 free, 1111 invalid
  const sampleRate = (b[2] >> 2) & 0x03 // 11 reserved
  return version !== 1 && layer !== 0 && bitrate !== 0 && bitrate !== 0x0f && sampleRate !== 3
}

/** Unicode byte-order marks — text, and never a binary signature. */
const sniffBom = (b: Uint8Array): Match | null => {
  if (startsWith(b, [0xff, 0xfe, 0x00, 0x00])) return hit('text/plain', 'txt', 'UTF-32LE text (BOM)', 0.8)
  if (startsWith(b, [0x00, 0x00, 0xfe, 0xff])) return hit('text/plain', 'txt', 'UTF-32BE text (BOM)', 0.8)
  if (startsWith(b, [0xff, 0xfe])) return hit('text/plain', 'txt', 'UTF-16LE text (BOM)', 0.8)
  if (startsWith(b, [0xfe, 0xff])) return hit('text/plain', 'txt', 'UTF-16BE text (BOM)', 0.8)
  return null
}

const sniffRiff = (b: Uint8Array): Match => {
  const form = ascii(b, 8, 4)
  if (form === 'WEBP') return hit('image/webp', 'webp', 'WebP image', 1)
  if (form === 'WAVE') return hit('audio/wav', 'wav', 'WAV audio', 1)
  if (form === 'AVI ') return hit('video/x-msvideo', 'avi', 'AVI video', 1)
  return hit('application/x-riff', '', 'RIFF container', 0.6)
}

/** Signature checks, most specific first. */
const sniffBinary = (b: Uint8Array): Match => {
  // Byte-order marks first: FF FE would otherwise read as an MPEG audio frame.
  const bom = sniffBom(b)
  if (bom) return bom
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return hit('image/png', 'png', 'PNG image', 1)
  if (startsWith(b, [0xff, 0xd8, 0xff])) return hit('image/jpeg', 'jpg', 'JPEG image', 1)
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a')
    return hit('image/gif', 'gif', 'GIF image', 1)
  if (ascii(b, 0, 4) === 'RIFF') return sniffRiff(b)
  if (ascii(b, 0, 5) === '%PDF-') return hit('application/pdf', 'pdf', 'PDF document', 1)
  if (startsWith(b, [0x50, 0x4b, 0x03, 0x04])) return sniffZip(b)
  if (startsWith(b, [0x50, 0x4b, 0x05, 0x06]) || startsWith(b, [0x50, 0x4b, 0x07, 0x08]))
    return hit('application/zip', 'zip', 'ZIP archive (empty or spanned)', 0.9)
  if (startsWith(b, [0x1f, 0x8b])) return hit('application/gzip', 'gz', 'gzip archive', 1)
  if (ascii(b, 0, 3) === 'BZh' && b[3] >= 0x31 && b[3] <= 0x39)
    return hit('application/x-bzip2', 'bz2', 'bzip2 archive', 1)
  if (startsWith(b, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]))
    return hit('application/x-xz', 'xz', 'XZ archive', 1)
  if (startsWith(b, [0x28, 0xb5, 0x2f, 0xfd])) return hit('application/zstd', 'zst', 'Zstandard archive', 1)
  if (startsWith(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))
    return hit('application/x-7z-compressed', '7z', '7-Zip archive', 1)
  if (ascii(b, 0, 4) === 'Rar!') return hit('application/vnd.rar', 'rar', 'RAR archive', 1)
  if (ascii(b, 0, 4) === 'MSCF') return hit('application/vnd.ms-cab-compressed', 'cab', 'Microsoft cabinet', 1)
  if (ascii(b, 0, 7) === '!<arch>') return hit('application/x-archive', 'ar', 'ar archive', 0.9)
  if (ascii(b, 257, 5) === 'ustar') return hit('application/x-tar', 'tar', 'tar archive', 0.95)
  if (startsWith(b, [0x7f, 0x45, 0x4c, 0x46])) return hit('application/x-executable', 'elf', 'ELF executable', 1)
  if (ascii(b, 0, 2) === 'MZ') {
    const mz = sniffMz(b)
    if (mz) return mz
  }
  if (startsWith(b, [0x00, 0x61, 0x73, 0x6d])) return hit('application/wasm', 'wasm', 'WebAssembly module', 1)
  if (startsWith(b, [0xca, 0xfe, 0xba, 0xbe]))
    return hit('application/java-vm', 'class', 'Java class file (or Mach-O universal binary)', 0.8)
  if (startsWith(b, [0x00, 0x00, 0x01, 0x00]))
    return hit('image/vnd.microsoft.icon', 'ico', 'Windows icon', 0.9)
  if (startsWith(b, [0x00, 0x00, 0x02, 0x00])) return hit('image/x-icon', 'cur', 'Windows cursor', 0.9)
  // "BM" alone is far too weak (it matches the text "BMW ..."), so also require the
  // two reserved 16-bit fields of the BMP file header to be zero.
  if (ascii(b, 0, 2) === 'BM' && b.length >= 14 && b[6] === 0 && b[7] === 0 && b[8] === 0 && b[9] === 0)
    return hit('image/bmp', 'bmp', 'BMP image', 0.9)
  if (startsWith(b, [0x49, 0x49, 0x2a, 0x00]) || startsWith(b, [0x4d, 0x4d, 0x00, 0x2a]))
    return hit('image/tiff', 'tif', 'TIFF image', 1)
  if (ascii(b, 0, 4) === '8BPS') return hit('image/vnd.adobe.photoshop', 'psd', 'Photoshop document', 1)
  if (startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) {
    // The EBML DocType sits in the first header and says which flavour this is.
    const doctype = ascii(b, 0, Math.min(b.length, 64))
    if (doctype.includes('webm')) return hit('video/webm', 'webm', 'WebM video', 0.95)
    if (doctype.includes('matroska')) return hit('video/x-matroska', 'mkv', 'Matroska container', 0.95)
    return hit('video/x-matroska', 'mkv', 'EBML container (Matroska/WebM)', 0.7)
  }
  if (ascii(b, 4, 4) === 'ftyp') return sniffIsoBmff(b)
  if (ascii(b, 0, 4) === 'OggS') return hit('audio/ogg', 'ogg', 'Ogg container', 1)
  if (ascii(b, 0, 4) === 'fLaC') return hit('audio/flac', 'flac', 'FLAC audio', 1)
  if (ascii(b, 0, 4) === 'MThd') return hit('audio/midi', 'mid', 'MIDI sequence', 1)
  if (ascii(b, 0, 3) === 'FLV') return hit('video/x-flv', 'flv', 'Flash video', 1)
  if (ascii(b, 0, 3) === 'ID3') return hit('audio/mpeg', 'mp3', 'MP3 audio (ID3 tagged)', 1)
  if (ascii(b, 0, 16) === 'SQLite format 3\u0000')
    return hit('application/vnd.sqlite3', 'sqlite', 'SQLite 3 database', 1)
  if (ascii(b, 0, 4) === 'wOFF') return hit('font/woff', 'woff', 'WOFF font', 1)
  if (ascii(b, 0, 4) === 'wOF2') return hit('font/woff2', 'woff2', 'WOFF2 font', 1)
  if (ascii(b, 0, 4) === 'OTTO') return hit('font/otf', 'otf', 'OpenType font', 1)
  if (ascii(b, 0, 4) === 'ttcf') return hit('font/collection', 'ttc', 'TrueType font collection', 1)
  if (startsWith(b, [0x00, 0x01, 0x00, 0x00]) || ascii(b, 0, 4) === 'true')
    return hit('font/ttf', 'ttf', 'TrueType font', 0.9)
  if (startsWith(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return hit('application/x-cfb', '', 'Microsoft compound file (legacy Office / msi)', 0.8)
  // Only "%!PS" is PostScript: a bare "%!" also opens LaTeX magic comments and other
  // interpreter directives, which are plain text.
  if (ascii(b, 0, 4) === '%!PS') return hit('application/postscript', 'ps', 'PostScript program', 1)
  // MPEG audio frame sync — checked last because 0xFF-prefixed data is common.
  if (isMpegAudioFrame(b)) return hit('audio/mpeg', 'mp3', 'MPEG audio frame', 0.6)
  return UNKNOWN
}

const decodeUtf8 = (b: Uint8Array): string | null => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b as unknown as BufferSource)
  } catch {
    return null
  }
}

/** Text formats have no magic number, so they are matched on their opening tokens. */
const sniffText = (text: string): Match => {
  const head = text.replace(/^\uFEFF/, '').trimStart()
  // Whitespace-only input decoded cleanly, so it is text, not unrecognised binary data.
  if (!head) return hit('text/plain', 'txt', 'Plain UTF-8 text', 0.3)
  if (/^<\?xml[\s?]/i.test(head)) {
    if (/<svg[\s>]/i.test(head.slice(0, 4096))) return hit('image/svg+xml', 'svg', 'SVG image', 0.85)
    return hit('application/xml', 'xml', 'XML document', 0.8)
  }
  if (/^<svg[\s>]/i.test(head)) return hit('image/svg+xml', 'svg', 'SVG image', 0.8)
  if (/^<!doctype\s+html/i.test(head) || /^<html[\s>]/i.test(head))
    return hit('text/html', 'html', 'HTML document', 0.8)
  if (/^-----BEGIN [A-Z0-9 ]+-----/.test(head)) return hit('application/x-pem-file', 'pem', 'PEM encoded block', 0.9)
  if (/^BEGIN:VCARD/i.test(head)) return hit('text/vcard', 'vcf', 'vCard contact', 0.9)
  if (/^BEGIN:VCALENDAR/i.test(head)) return hit('text/calendar', 'ics', 'iCalendar document', 0.9)
  if (/^#!/.test(head)) return hit('text/x-shellscript', 'sh', 'Script with shebang line', 0.7)
  if (/^%!PS/.test(head)) return hit('application/postscript', 'ps', 'PostScript program', 0.9)
  if (/^d\d+:/.test(head) && head.includes('announce')) return hit('application/x-bittorrent', 'torrent', 'BitTorrent metainfo', 0.7)
  if (/^[[{]/.test(head)) {
    try {
      JSON.parse(text)
      return hit('application/json', 'json', 'JSON document', 0.7)
    } catch {
      /* not JSON after all — fall through to plain text */
    }
  }
  if (/^<[a-z]/i.test(head)) return hit('application/xml', 'xml', 'XML-like markup', 0.5)
  return hit('text/plain', 'txt', 'Plain UTF-8 text', 0.3)
}

const sniff = (b: Uint8Array): Match => {
  if (b.length === 0) return { mime: '', extension: '', description: '', confidence: 0 }
  const binary = sniffBinary(b)
  if (binary.confidence > 0) return binary
  const text = decodeUtf8(b)
  if (text !== null && !text.includes('\u0000')) {
    return sniffText(text)
  }
  return UNKNOWN
}

const bytesFromLatin1OrUtf8 = (s: string): Uint8Array => {
  let allBytes = true
  for (let i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 0xff) {
      allBytes = false
      break
    }
  }
  if (!allBytes) return new TextEncoder().encode(s)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

const hexCandidate = (s: string): Uint8Array | null => {
  const compact = s.replace(/\s+/g, '').replace(/^0x/i, '')
  if (compact.length < 8 || compact.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(compact)) return null
  const out = new Uint8Array(compact.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(compact.slice(i * 2, i * 2 + 2), 16)
  return out
}

const base64Candidate = (s: string): Uint8Array | null => {
  const compact = s.replace(/\s+/g, '')
  if (compact.length < 8) return null
  if (!/^[A-Za-z0-9+/=]+$/.test(compact) && !/^[A-Za-z0-9\-_=]+$/.test(compact)) return null
  const normal = compact.replace(/-/g, '+').replace(/_/g, '/').replace(/(?<!=)=+$/, '')
  if (normal.length % 4 === 1) return null
  try {
    const bin = atob(normal.padEnd(Math.ceil(normal.length / 4) * 4, '='))
    const out = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
    return out
  } catch {
    return null
  }
}

const util: Utility = {
  id: 'mime_from_magic',
  name: 'detect file type',
  category: 'Analysis',
  description:
    'Identify a file type from its magic-number signature, accepting raw bytes or a hex, base64 or literal representation of the leading bytes.',
  accepts: ['string', 'bytes'],
  produces: 'json',
  tags: ['file signature', 'magic bytes', 'content type detection', 'file command', 'sniff mime type'],
  aliases: ['file'],
  examples: [
    {
      title: 'a PNG signature, as hex',
      input: '89504e470d0a1a0a',
      inputEncoding: 'hex',
      output: JSON.stringify({ mime: 'image/png', extension: 'png', description: 'PNG image', confidence: 1 }, null, 2)
    }
  ],
  params: {},
  apply: (input: any) => {
    if (isBytes(input)) return sniff(input as Uint8Array)
    if (input === null || input === undefined) return sniff(new Uint8Array(0))
    if (typeof input !== 'string') {
      if (typeof input === 'object') throw new Error('detect file type expects text or bytes, not structured data')
      return sniff(bytesFromLatin1OrUtf8(String(input)))
    }
    if (input === '') return sniff(new Uint8Array(0))

    // A string could be hex, base64 or the raw bytes themselves. Try each and keep the
    // most confident reading, preferring the earlier candidate on a tie.
    const candidates: Uint8Array[] = []
    const hex = hexCandidate(input)
    if (hex) candidates.push(hex)
    const b64 = base64Candidate(input)
    if (b64) candidates.push(b64)
    candidates.push(bytesFromLatin1OrUtf8(input))

    let best = sniff(candidates[0])
    for (let i = 1; i < candidates.length; i++) {
      const next = sniff(candidates[i])
      if (next.confidence > best.confidence) best = next
    }
    return best
  }
}

export default util
