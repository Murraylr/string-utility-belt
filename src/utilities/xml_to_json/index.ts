import type { Utility } from '@/types/utility'

/**
 * XML -> JSON via DOMParser('text/xml').
 *
 * Compact mode (default) mirrors the popular "compact" convention:
 *  - attributes become `@name` keys (prefix configurable)
 *  - an element with only text becomes that string
 *  - a child name seen once becomes a value, seen twice becomes an array
 *  - text living alongside attributes/children is stored under `#text`
 * Verbose mode (compact = false) always produces objects, always arrays for
 * children, and always includes the text key.
 */

const MOZ_ERROR_NS = 'http://www.mozilla.org/newlayout/xml/parsererror.xml'

const NODE_ELEMENT = 1
const NODE_TEXT = 3
const NODE_CDATA = 4

type Opts = { prefix: string; textKey: string; compact: boolean }

/**
 * Collapse the formatting whitespace a pretty-printer introduces without
 * touching intentional inner spacing.
 */
const tidyText = (raw: string) => (raw.trim() === '' ? '' : raw.trim())

export function convertElement(el: Element, o: Opts): unknown {
  const out: Record<string, unknown> = {}
  let attrCount = 0

  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i]
    out[o.prefix + attr.name] = attr.value
    attrCount++
  }

  const groups: [string, unknown[]][] = []
  const index = new Map<string, unknown[]>()
  let rawText = ''

  const children = el.childNodes
  for (let i = 0; i < children.length; i++) {
    const node = children[i]
    if (node.nodeType === NODE_ELEMENT) {
      const child = node as Element
      const key = child.nodeName
      const value = convertElement(child, o)
      const bucket = index.get(key)
      if (bucket) bucket.push(value)
      else {
        const created = [value]
        index.set(key, created)
        groups.push([key, created])
      }
    } else if (node.nodeType === NODE_TEXT || node.nodeType === NODE_CDATA) {
      rawText += node.nodeValue ?? ''
    }
    // comments and processing instructions are dropped
  }

  const text = tidyText(rawText)

  if (!o.compact) {
    for (const [key, values] of groups) out[key] = values
    out[o.textKey] = text
    return out
  }

  if (attrCount === 0 && groups.length === 0) return text

  for (const [key, values] of groups) out[key] = values.length === 1 ? values[0] : values
  if (text !== '') out[o.textKey] = text
  return out
}

const util: Utility = {
  id: 'xml_to_json',
  name: 'xml to json',
  category: 'Data Formats',
  description:
    'Parse XML into JSON, with a configurable attribute prefix and text key, a compact mode that collapses single children, and an optional indented string output.',
  accepts: 'string',
  produces: ['json', 'string'],
  params: {
    attributePrefix: { kind: 'string', label: 'attribute prefix', default: '@' },
    textKey: { kind: 'string', label: 'text key', default: '#text' },
    compact: { kind: 'boolean', label: 'compact', default: true },
    indent: { kind: 'number', label: 'indent (string output)', default: 2, min: 0, integer: true, max: 10 },
    output: { kind: 'select', label: 'output', options: ['json', 'string'], default: 'json' }
  },
  tags: ['xml', 'json', 'convert', 'parse', 'soap', 'rss', 'dom'],
  examples: [
    {
      title: 'attribute + child element',
      input: '<user id="1"><name>Ann</name></user>',
      output: '{\n  "user": {\n    "@id": "1",\n    "name": "Ann"\n  }\n}'
    },
    {
      title: 'string output',
      input: '<a>1</a>',
      params: { output: 'string', indent: 2 },
      output: '{\n  "a": "1"\n}'
    }
  ],
  apply: (input: any, params: any = {}) => {
    const prefix = params.attributePrefix === undefined ? '@' : String(params.attributePrefix)
    const textKey = String(params.textKey ?? '') || '#text'
    const compact = params.compact !== false
    const indent = Math.max(0, Math.floor(Number(params.indent ?? 2)) || 0)
    const output = String(params.output ?? 'json') === 'string' ? 'string' : 'json'

    const source = typeof input === 'string' ? input : String(input ?? '')
    const finish = (value: Record<string, unknown>) =>
      output === 'string' ? JSON.stringify(value, null, indent) : value

    if (source.trim() === '') return finish({})

    const doc = new DOMParser().parseFromString(source, 'text/xml')
    const root = doc.documentElement

    if (!root) throw new Error('invalid XML: no document element')

    // Parse failures surface as a <parsererror> element in Mozilla's error
    // namespace. Matching on the namespace (never on the bare tag name) keeps a
    // legitimate document whose own root happens to be called `parsererror`
    // from being rejected as invalid.
    const errorNode =
      (root.namespaceURI === MOZ_ERROR_NS && root.localName === 'parsererror' ? root : null) ??
      doc.getElementsByTagNameNS(MOZ_ERROR_NS, 'parsererror')[0] ??
      null

    if (errorNode) {
      const detail = (errorNode.textContent || '').replace(/\s+/g, ' ').trim()
      throw new Error(`invalid XML${detail ? `: ${detail}` : ''}`)
    }

    return finish({ [root.nodeName]: convertElement(root, { prefix, textKey, compact }) })
  }
}

export default util
