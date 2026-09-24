import type { Utility } from '@/types/utility'

/**
 * JSON -> XML.
 *
 * Conventions (chosen so that `xml_to_json` -> `json_to_xml` round-trips):
 *  - keys starting with `attributePrefix` ("@id") become attributes
 *  - the key `#text` becomes the element's text content
 *  - an array in a property position becomes repeated sibling elements
 *  - an array in an item position becomes `itemName` children
 *  - a single-key object at the top level supplies the root element name
 */

const TEXT_KEY = '#text'

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array)

/**
 * A carriage return in character data is normalised to "\n" by every XML
 * parser, so it has to leave here as a character reference or the value cannot
 * survive a round trip.
 */
const escapeText = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r/g, '&#13;')

const escapeAttr = (s: string) =>
  escapeText(s)
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;')

/** Coerce any JSON scalar to element/attribute text. */
const toText = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : ''
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  // objects/arrays only reach here in attribute or #text position, where XML
  // has no structure to give them: JSON is a far better rendering than
  // "[object Object]".
  try {
    return JSON.stringify(v) ?? String(v)
  } catch {
    return String(v)
  }
}

/**
 * Make an arbitrary JSON key usable as an XML name. XML names allow letters
 * (including astral-plane ones), digits, `.`, `-`, `_` and `:`; anything else is
 * replaced. Iterating with a unicode-aware regex keeps emoji/CJK keys intact
 * instead of shredding surrogate pairs.
 */
export const sanitizeName = (raw: string): string => {
  let name = String(raw).replace(/[^\p{L}\p{N}._:-]/gu, '_')
  if (!name) return '_'
  if (!/^[\p{L}_:]/u.test(name)) name = '_' + name
  return name
}

type Ctx = {
  itemName: string
  prefix: string
  indent: number
  lines: string[]
}

const padFor = (ctx: Ctx, depth: number) => (ctx.indent > 0 ? ' '.repeat(ctx.indent * depth) : '')

/** A value in property position: arrays fan out into repeated sibling elements. */
function emitValue(ctx: Ctx, name: string, value: unknown, depth: number): void {
  if (Array.isArray(value)) {
    // An empty array has no sibling to fan out to; emit one empty element so
    // the key is still visible instead of silently disappearing.
    if (value.length === 0) {
      ctx.lines.push(`${padFor(ctx, depth)}<${sanitizeName(name)}/>`)
      return
    }
    for (const item of value) emitElement(ctx, name, item, depth)
    return
  }
  emitElement(ctx, name, value, depth)
}

/** Emit exactly one `<name>` element for `value`. */
function emitElement(ctx: Ctx, rawName: string, value: unknown, depth: number): void {
  const name = sanitizeName(rawName)
  const pad = padFor(ctx, depth)

  if (value === null || value === undefined) {
    ctx.lines.push(`${pad}<${name}/>`)
    return
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      ctx.lines.push(`${pad}<${name}/>`)
      return
    }
    ctx.lines.push(`${pad}<${name}>`)
    for (const item of value) emitElement(ctx, ctx.itemName, item, depth + 1)
    ctx.lines.push(`${pad}</${name}>`)
    return
  }

  if (isPlainObject(value)) {
    const attrs: string[] = []
    let text: string | null = null
    const children: [string, unknown][] = []

    for (const [key, v] of Object.entries(value)) {
      if (ctx.prefix && key.length > ctx.prefix.length && key.startsWith(ctx.prefix)) {
        attrs.push(` ${sanitizeName(key.slice(ctx.prefix.length))}="${escapeAttr(toText(v))}"`)
      } else if (key === TEXT_KEY) {
        text = toText(v)
      } else {
        children.push([key, v])
      }
    }

    const attrStr = attrs.join('')
    const sub: string[] = []
    const subCtx: Ctx = { ...ctx, lines: sub }
    for (const [key, v] of children) emitValue(subCtx, key, v, depth + 1)

    if (sub.length === 0) {
      if (text === null) ctx.lines.push(`${pad}<${name}${attrStr}/>`)
      else ctx.lines.push(`${pad}<${name}${attrStr}>${escapeText(text)}</${name}>`)
      return
    }

    ctx.lines.push(`${pad}<${name}${attrStr}>`)
    if (text !== null && text !== '') ctx.lines.push(`${padFor(ctx, depth + 1)}${escapeText(text)}`)
    ctx.lines.push(...sub)
    ctx.lines.push(`${pad}</${name}>`)
    return
  }

  ctx.lines.push(`${pad}<${name}>${escapeText(toText(value))}</${name}>`)
}

const util: Utility = {
  id: 'json_to_xml',
  name: 'json to xml',
  category: 'Data Formats',
  description:
    'Convert JSON to XML, with control over the root element name (a single top-level key names the root while root element is left at "root"), the array item element name, indent width, the attribute key prefix, and the XML declaration.',
  accepts: ['string', 'json'],
  produces: 'string',
  tags: ['xml', 'json', 'convert', 'attributes', 'serialize', 'markup'],
  examples: [
    {
      title: 'single top-level key becomes the root, @attr prefix',
      input: '{"note":{"@id":"1","to":"Tove","from":"Jani"}}',
      output:
        '<?xml version="1.0" encoding="UTF-8"?>\n<note id="1">\n  <to>Tove</to>\n  <from>Jani</from>\n</note>',
    },
    {
      title: 'no declaration',
      input: '{"config":{"debug":true,"retries":3}}',
      params: { declaration: false },
      output: '<config>\n  <debug>true</debug>\n  <retries>3</retries>\n</config>',
    },
  ],
  params: {
    rootName: { kind: 'string', label: 'root element', default: 'root' },
    itemName: { kind: 'string', label: 'array item element', default: 'item' },
    indent: { kind: 'number', label: 'indent (0 = single line)', default: 2, min: 0, integer: true, max: 16 },
    attributePrefix: { kind: 'string', label: 'attribute prefix', default: '@' },
    declaration: { kind: 'boolean', label: 'xml declaration', default: true }
  },
  apply: (input: any, params: any = {}) => {
    const rootNameRaw = String(params.rootName ?? '')
    const rootName = sanitizeName(rootNameRaw || 'root')
    // An explicitly chosen root name must win over the "single top-level key
    // becomes the root" convenience, otherwise the param would look inert.
    const rootNameIsExplicit = rootNameRaw !== '' && rootNameRaw !== 'root'
    const itemName = sanitizeName(String(params.itemName ?? '') || 'item')
    const indent = Math.max(0, Math.floor(Number(params.indent ?? 2)) || 0)
    const prefix = params.attributePrefix === undefined ? '@' : String(params.attributePrefix)
    const declaration = params.declaration !== false

    // Normalise the incoming value: a previous step may hand us a string, raw
    // bytes, a parsed object, or an array.
    let data: unknown
    if (input instanceof Uint8Array) {
      const text = new TextDecoder().decode(input)
      if (text.trim() === '') return ''
      data = parseJson(text)
    } else if (typeof input === 'string') {
      if (input.trim() === '') return ''
      data = parseJson(input)
    } else if (input === null || input === undefined) {
      return ''
    } else {
      data = input
    }

    // A single-key object already names its own root ({ note: {...} } -> <note>).
    let rootTag = rootName
    let rootValue: unknown = data
    if (!rootNameIsExplicit && isPlainObject(data)) {
      const keys = Object.keys(data)
      if (keys.length === 1) {
        const key = keys[0]
        const isAttrKey = prefix !== '' && key.length > prefix.length && key.startsWith(prefix)
        if (!isAttrKey && key !== TEXT_KEY && !Array.isArray(data[key])) {
          rootTag = sanitizeName(key)
          rootValue = data[key]
        }
      }
    }

    const ctx: Ctx = { itemName, prefix, indent, lines: [] }
    emitElement(ctx, rootTag, rootValue, 0)

    const body = indent > 0 ? ctx.lines.join('\n') : ctx.lines.join('')
    if (!declaration) return body
    const decl = '<?xml version="1.0" encoding="UTF-8"?>'
    return indent > 0 ? `${decl}\n${body}` : `${decl}${body}`
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch (e: any) {
    throw new Error(`invalid JSON: ${e?.message || String(e)}`)
  }
}

export default util
