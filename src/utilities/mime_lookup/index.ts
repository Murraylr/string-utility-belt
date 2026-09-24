import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

/**
 * Extension -> MIME type. Insertion order matters: the reverse table is built
 * first-wins, so the canonical extension for a type is listed before its aliases
 * (`jpg` before `jpeg`, `html` before `htm`, ...). PREFERRED_EXTENSION below fixes
 * the handful of cases where that ordering is inconvenient.
 */
export const EXT_TO_MIME: Record<string, string> = {
  // --- plain text, markup, config ---
  txt: 'text/plain',
  text: 'text/plain',
  log: 'text/plain',
  ini: 'text/plain',
  cfg: 'text/plain',
  conf: 'text/plain',
  env: 'text/plain',
  properties: 'text/plain',
  md: 'text/markdown',
  markdown: 'text/markdown',
  mdx: 'text/mdx',
  rst: 'text/x-rst',
  adoc: 'text/asciidoc',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  html: 'text/html',
  htm: 'text/html',
  xhtml: 'application/xhtml+xml',
  css: 'text/css',
  scss: 'text/x-scss',
  sass: 'text/x-sass',
  less: 'text/x-less',
  rtf: 'application/rtf',
  vcf: 'text/vcard',
  ics: 'text/calendar',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  ass: 'text/x-ssa',
  tex: 'application/x-tex',
  bib: 'application/x-bibtex',

  // --- data & interchange ---
  json: 'application/json',
  json5: 'application/json5',
  jsonc: 'application/json',
  jsonld: 'application/ld+json',
  jsonl: 'application/jsonl',
  ndjson: 'application/x-ndjson',
  geojson: 'application/geo+json',
  har: 'application/json',
  webmanifest: 'application/manifest+json',
  xml: 'application/xml',
  xsd: 'application/xml',
  dtd: 'application/xml-dtd',
  xsl: 'application/xslt+xml',
  xslt: 'application/xslt+xml',
  wsdl: 'application/wsdl+xml',
  soap: 'application/soap+xml',
  rss: 'application/rss+xml',
  atom: 'application/atom+xml',
  rdf: 'application/rdf+xml',
  ttl: 'text/turtle',
  n3: 'text/n3',
  nt: 'application/n-triples',
  sparql: 'application/sparql-query',
  yaml: 'application/yaml',
  yml: 'application/yaml',
  toml: 'application/toml',
  cbor: 'application/cbor',
  bson: 'application/bson',
  msgpack: 'application/x-msgpack',
  avro: 'application/avro',
  parquet: 'application/vnd.apache.parquet',
  orc: 'application/x-orc',
  protobuf: 'application/x-protobuf',
  proto: 'text/x-protobuf',
  sqlite: 'application/vnd.sqlite3',
  sqlite3: 'application/vnd.sqlite3',
  db: 'application/vnd.sqlite3',
  sql: 'application/sql',
  graphql: 'application/graphql',
  gql: 'application/graphql',
  kml: 'application/vnd.google-earth.kml+xml',
  kmz: 'application/vnd.google-earth.kmz',
  gpx: 'application/gpx+xml',
  npy: 'application/x-npy',
  h5: 'application/x-hdf5',
  nc: 'application/x-netcdf',
  mat: 'application/x-matlab-data',
  sav: 'application/x-spss-sav',
  dta: 'application/x-stata-dta',
  pcap: 'application/vnd.tcpdump.pcap',
  pcapng: 'application/vnd.tcpdump.pcap',

  // --- source code ---
  js: 'text/javascript',
  mjs: 'text/javascript',
  cjs: 'text/javascript',
  jsx: 'text/jsx',
  ts: 'text/typescript',
  mts: 'text/typescript',
  tsx: 'text/tsx',
  map: 'application/json',
  c: 'text/x-c',
  h: 'text/x-c',
  cpp: 'text/x-c++src',
  cc: 'text/x-c++src',
  cxx: 'text/x-c++src',
  hpp: 'text/x-c++hdr',
  cs: 'text/x-csharp',
  java: 'text/x-java-source',
  kt: 'text/x-kotlin',
  kts: 'text/x-kotlin',
  scala: 'text/x-scala',
  go: 'text/x-go',
  rs: 'text/rust',
  py: 'text/x-python',
  pyc: 'application/x-python-code',
  ipynb: 'application/x-ipynb+json',
  rb: 'text/x-ruby',
  php: 'application/x-httpd-php',
  pl: 'text/x-perl',
  pm: 'text/x-perl',
  lua: 'text/x-lua',
  r: 'text/x-r',
  swift: 'text/x-swift',
  dart: 'text/x-dart',
  sh: 'application/x-sh',
  bash: 'application/x-sh',
  zsh: 'application/x-sh',
  fish: 'application/x-sh',
  bat: 'application/x-bat',
  cmd: 'application/x-bat',
  ps1: 'application/x-powershell',
  psm1: 'application/x-powershell',
  vb: 'text/x-vb',
  vbs: 'text/vbscript',
  asm: 'text/x-asm',
  s: 'text/x-asm',
  clj: 'text/x-clojure',
  ex: 'text/x-elixir',
  exs: 'text/x-elixir',
  erl: 'text/x-erlang',
  hs: 'text/x-haskell',
  ml: 'text/x-ocaml',
  elm: 'text/x-elm',
  nim: 'text/x-nim',
  zig: 'text/x-zig',
  groovy: 'text/x-groovy',
  gradle: 'text/x-gradle',
  tf: 'application/x-terraform',
  dockerfile: 'text/x-dockerfile',
  makefile: 'text/x-makefile',
  cmake: 'text/x-cmake',
  diff: 'text/x-diff',
  patch: 'text/x-diff',
  wasm: 'application/wasm',
  class: 'application/java-vm',
  jar: 'application/java-archive',
  war: 'application/java-archive',

  // --- images ---
  png: 'image/png',
  apng: 'image/apng',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jpe: 'image/jpeg',
  jfif: 'image/jpeg',
  gif: 'image/gif',
  bmp: 'image/bmp',
  dib: 'image/bmp',
  webp: 'image/webp',
  avif: 'image/avif',
  heic: 'image/heic',
  heif: 'image/heif',
  jxl: 'image/jxl',
  tif: 'image/tiff',
  tiff: 'image/tiff',
  ico: 'image/vnd.microsoft.icon',
  cur: 'image/x-icon',
  svg: 'image/svg+xml',
  svgz: 'image/svg+xml',
  psd: 'image/vnd.adobe.photoshop',
  xcf: 'image/x-xcf',
  ps: 'application/postscript',
  eps: 'application/postscript',
  ai: 'application/postscript',
  pbm: 'image/x-portable-bitmap',
  pgm: 'image/x-portable-graymap',
  ppm: 'image/x-portable-pixmap',
  pnm: 'image/x-portable-anymap',
  tga: 'image/x-tga',
  dds: 'image/vnd-ms.dds',
  exr: 'image/x-exr',
  hdr: 'image/vnd.radiance',
  cr2: 'image/x-canon-cr2',
  nef: 'image/x-nikon-nef',
  dng: 'image/x-adobe-dng',
  djvu: 'image/vnd.djvu',
  dwg: 'image/vnd.dwg',
  dxf: 'image/vnd.dxf',

  // --- audio ---
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  flac: 'audio/flac',
  wav: 'audio/wav',
  wave: 'audio/wav',
  weba: 'audio/webm',
  aiff: 'audio/x-aiff',
  aif: 'audio/x-aiff',
  wma: 'audio/x-ms-wma',
  mid: 'audio/midi',
  midi: 'audio/midi',
  amr: 'audio/amr',
  au: 'audio/basic',
  caf: 'audio/x-caf',
  ape: 'audio/x-ape',
  mka: 'audio/x-matroska',
  ra: 'audio/x-realaudio',

  // --- video ---
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  qt: 'video/quicktime',
  avi: 'video/x-msvideo',
  wmv: 'video/x-ms-wmv',
  flv: 'video/x-flv',
  f4v: 'video/x-f4v',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  mpe: 'video/mpeg',
  ogv: 'video/ogg',
  '3gp': 'video/3gpp',
  '3g2': 'video/3gpp2',
  m2ts: 'video/mp2t',
  m3u8: 'application/vnd.apple.mpegurl',
  mpd: 'application/dash+xml',
  asf: 'video/x-ms-asf',
  vob: 'video/x-ms-vob',
  rm: 'application/vnd.rn-realmedia',
  swf: 'application/x-shockwave-flash',

  // --- fonts ---
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttc: 'font/collection',
  eot: 'application/vnd.ms-fontobject',
  pfb: 'application/x-font-type1',

  // --- archives & packages ---
  zip: 'application/zip',
  gz: 'application/gzip',
  tgz: 'application/gzip',
  tar: 'application/x-tar',
  bz2: 'application/x-bzip2',
  tbz2: 'application/x-bzip2',
  xz: 'application/x-xz',
  lz: 'application/x-lzip',
  lzma: 'application/x-lzma',
  zst: 'application/zstd',
  '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar',
  cab: 'application/vnd.ms-cab-compressed',
  z: 'application/x-compress',
  lzh: 'application/x-lzh-compressed',
  arj: 'application/x-arj',
  cpio: 'application/x-cpio',
  ar: 'application/x-archive',
  iso: 'application/x-iso9660-image',
  dmg: 'application/x-apple-diskimage',
  deb: 'application/vnd.debian.binary-package',
  rpm: 'application/x-rpm',
  apk: 'application/vnd.android.package-archive',
  msi: 'application/x-msdownload',
  exe: 'application/vnd.microsoft.portable-executable',
  dll: 'application/vnd.microsoft.portable-executable',
  so: 'application/x-sharedlib',
  dylib: 'application/x-mach-binary',
  elf: 'application/x-executable',
  crx: 'application/x-chrome-extension',
  xpi: 'application/x-xpinstall',
  whl: 'application/x-wheel+zip',
  nupkg: 'application/x-nupkg+zip',
  torrent: 'application/x-bittorrent',

  // --- documents ---
  pdf: 'application/pdf',
  doc: 'application/msword',
  dot: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  dotx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.template',
  docm: 'application/vnd.ms-word.document.macroenabled.12',
  xls: 'application/vnd.ms-excel',
  xlt: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xltx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
  xlsm: 'application/vnd.ms-excel.sheet.macroenabled.12',
  xlsb: 'application/vnd.ms-excel.sheet.binary.macroenabled.12',
  ppt: 'application/vnd.ms-powerpoint',
  pps: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ppsx: 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
  potx: 'application/vnd.openxmlformats-officedocument.presentationml.template',
  pptm: 'application/vnd.ms-powerpoint.presentation.macroenabled.12',
  odt: 'application/vnd.oasis.opendocument.text',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
  odp: 'application/vnd.oasis.opendocument.presentation',
  odg: 'application/vnd.oasis.opendocument.graphics',
  odf: 'application/vnd.oasis.opendocument.formula',
  epub: 'application/epub+zip',
  mobi: 'application/x-mobipocket-ebook',
  azw3: 'application/vnd.amazon.ebook',
  fb2: 'application/x-fictionbook+xml',
  chm: 'application/vnd.ms-htmlhelp',
  pages: 'application/vnd.apple.pages',
  numbers: 'application/vnd.apple.numbers',
  keynote: 'application/vnd.apple.keynote',
  wpd: 'application/vnd.wordperfect',

  // --- 3d & models ---
  stl: 'model/stl',
  obj: 'model/obj',
  gltf: 'model/gltf+json',
  glb: 'model/gltf-binary',
  '3mf': 'model/3mf',
  ply: 'model/ply',
  usdz: 'model/vnd.usdz+zip',

  // --- crypto, mail & shell items ---
  pem: 'application/x-pem-file',
  key: 'application/pkcs8',
  crt: 'application/x-x509-ca-cert',
  cer: 'application/x-x509-ca-cert',
  der: 'application/x-x509-ca-cert',
  csr: 'application/pkcs10',
  crl: 'application/pkix-crl',
  p12: 'application/x-pkcs12',
  pfx: 'application/x-pkcs12',
  p7b: 'application/x-pkcs7-certificates',
  p7s: 'application/pkcs7-signature',
  gpg: 'application/pgp-encrypted',
  asc: 'application/pgp-signature',
  sig: 'application/pgp-signature',
  eml: 'message/rfc822',
  mht: 'multipart/related',
  msg: 'application/vnd.ms-outlook',
  url: 'application/internet-shortcut',
  lnk: 'application/x-ms-shortcut',
  appcache: 'text/cache-manifest',
  bin: 'application/octet-stream',
  dat: 'application/octet-stream',
  img: 'application/octet-stream'
}

/** Canonical extension for types where first-wins would pick an awkward alias. */
const PREFERRED_EXTENSION: Record<string, string> = {
  'application/postscript': 'ps',
  'application/json': 'json',
  'application/octet-stream': 'bin',
  'application/vnd.sqlite3': 'sqlite',
  'application/xml': 'xml',
  'application/yaml': 'yaml',
  'application/x-sh': 'sh',
  'application/x-bat': 'bat',
  'application/x-powershell': 'ps1',
  'application/java-archive': 'jar',
  'application/gzip': 'gz',
  'application/x-bzip2': 'bz2',
  'application/x-pkcs12': 'p12',
  'application/x-x509-ca-cert': 'crt',
  'application/pgp-signature': 'asc',
  'application/vnd.microsoft.portable-executable': 'exe',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/html': 'html',
  'text/javascript': 'js',
  'text/typescript': 'ts',
  'text/x-c': 'c',
  'text/x-c++src': 'cpp',
  'text/x-perl': 'pl',
  'text/x-asm': 'asm',
  'text/x-diff': 'diff',
  'text/x-elixir': 'ex',
  'text/x-kotlin': 'kt',
  'image/jpeg': 'jpg',
  'image/x-icon': 'ico',
  'image/tiff': 'tif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
  'audio/midi': 'mid',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/x-aiff': 'aiff',
  'video/mpeg': 'mpg',
  'video/quicktime': 'mov',
  'font/collection': 'ttc'
}

/** Legacy / vendor spellings that should resolve to a canonical type. */
const MIME_ALIASES: Record<string, string> = {
  'text/xml': 'application/xml',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/x-png': 'image/png',
  'image/ico': 'image/vnd.microsoft.icon',
  'application/x-javascript': 'text/javascript',
  'application/javascript': 'text/javascript',
  'text/ecmascript': 'text/javascript',
  'application/ecmascript': 'text/javascript',
  'application/x-gzip': 'application/gzip',
  'application/x-zip-compressed': 'application/zip',
  'application/x-rar-compressed': 'application/vnd.rar',
  'application/x-yaml': 'application/yaml',
  'text/yaml': 'application/yaml',
  'text/x-yaml': 'application/yaml',
  'application/x-toml': 'application/toml',
  'text/csv-schema': 'text/csv',
  'application/x-pdf': 'application/pdf',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
  'audio/mp3': 'audio/mpeg',
  'audio/x-mpeg': 'audio/mpeg',
  'audio/x-flac': 'audio/flac',
  'application/x-font-ttf': 'font/ttf',
  'application/font-woff': 'font/woff',
  'application/x-woff': 'font/woff'
}

const MIME_TO_EXT: Record<string, string> = (() => {
  const out: Record<string, string> = {}
  for (const [ext, mime] of Object.entries(EXT_TO_MIME)) {
    if (!(mime in out)) out[mime] = ext
  }
  return { ...out, ...PREFERRED_EXTENSION }
})()

const MIME_SHAPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/

const asText = (input: unknown): string => {
  if (typeof input === 'string') return input
  if (input === null || input === undefined) return ''
  if (isBytes(input)) return new TextDecoder().decode(input as Uint8Array)
  if (typeof input === 'object') throw new Error('mime lookup expects text input, not structured data')
  return String(input)
}

/** A table entry, never an inherited Object.prototype member (`constructor`, `__proto__`…). */
const own = (table: Record<string, string>, key: string): string | undefined =>
  Object.prototype.hasOwnProperty.call(table, key) ? table[key] : undefined

/** Reduce `docs/report.PDF`, `.pdf` or `pdf` down to the bare lower-case extension. */
const extensionOf = (token: string): string => {
  const base = token.trim().replace(/^.*[\\/]/, '').replace(/[?#].*$/, '')
  const trimmed = base.replace(/^\.+/, '')
  if (!trimmed) return ''
  const dot = trimmed.lastIndexOf('.')
  return (dot >= 0 ? trimmed.slice(dot + 1) : trimmed).toLowerCase()
}

const extensionToMime = (token: string): string => {
  const ext = extensionOf(token)
  if (!ext) throw new Error(`no file extension found in "${token.trim()}"`)
  const mime = own(EXT_TO_MIME, ext)
  if (!mime) throw new Error(`no mime type known for extension ".${ext}"`)
  return mime
}

const mimeToExtension = (token: string): string => {
  const bare = token.trim().split(';')[0].trim().toLowerCase()
  if (!MIME_SHAPE.test(bare)) throw new Error(`not a valid mime type: "${token.trim()}"`)
  const canonical = own(MIME_ALIASES, bare) ?? bare
  const direct = own(MIME_TO_EXT, canonical)
  if (direct) return direct
  // Structured syntax suffix fallback: application/vnd.something+json -> json
  const plus = canonical.lastIndexOf('+')
  if (plus > -1) {
    const suffix = canonical.slice(plus + 1)
    if (own(EXT_TO_MIME, suffix)) return suffix
  }
  throw new Error(`no extension known for mime type "${bare}"`)
}

/** IANA top-level types — used so `docs/report.pdf` reads as a path, not a media type. */
const TOP_LEVEL_TYPES = new Set([
  'application', 'audio', 'chemical', 'example', 'font', 'image',
  'message', 'model', 'multipart', 'text', 'video'
])

const looksLikeMime = (token: string): boolean => {
  const bare = token.trim().split(';')[0].trim().toLowerCase()
  const slash = bare.indexOf('/')
  if (slash < 1) return false
  const type = bare.slice(0, slash)
  // A well-known top-level type is enough — the subtype may be a wildcard or otherwise
  // malformed, and "image/*" deserves the mime-type error, not an extension one.
  return TOP_LEVEL_TYPES.has(type) || type.startsWith('x-')
}

const lookup = (token: string, direction: string): string => {
  if (direction === 'extension-to-mime') return extensionToMime(token)
  if (direction === 'mime-to-extension') return mimeToExtension(token)
  // auto: prefer the mime reading, but fall back to the path reading so that a relative
  // path whose first segment happens to be a media type ("text/notes.md") still works.
  if (looksLikeMime(token)) {
    try {
      return mimeToExtension(token)
    } catch (mimeError) {
      try {
        return extensionToMime(token)
      } catch {
        throw mimeError
      }
    }
  }
  return extensionToMime(token)
}

const util: Utility = {
  id: 'mime_lookup',
  name: 'mime type lookup',
  category: 'Web & Dev',
  description:
    'Look up the MIME type for a file extension or filename, or the canonical extension for a MIME type, one token per line or over the whole input.',
  accepts: 'string',
  produces: 'string',
  tags: ['mime type', 'content type', 'file extension', 'media type', 'mime', 'content-type'],
  examples: [
    {
      title: 'filename to mime type',
      input: 'report.pdf',
      params: { direction: 'auto' },
      output: 'application/pdf'
    },
    {
      title: 'mime type to extension',
      input: 'application/json',
      params: { direction: 'auto' },
      output: 'json'
    }
  ],
  params: {
    direction: {
      kind: 'select',
      label: 'direction',
      options: ['auto', 'extension-to-mime', 'mime-to-extension'],
      default: 'auto'
    },
    perLine: { kind: 'boolean', label: 'per line', default: true }
  },
  apply: (input: any, { direction, perLine }: any) => {
    const text = asText(input)
    const dir = typeof direction === 'string' && direction ? direction : 'auto'
    if (!text.trim()) return ''

    if (perLine === false) return lookup(text.trim(), dir)

    return text
      .split(/\r?\n/)
      .map((line) => (line.trim() ? lookup(line, dir) : ''))
      .join('\n')
  }
}

export default util
