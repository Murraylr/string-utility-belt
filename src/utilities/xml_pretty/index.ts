import type { Utility } from '@/types/utility'

/**
 * Re-indents XML with a hand-rolled tokenizer so that comments, CDATA
 * sections, processing instructions and the doctype survive untouched
 * (DOMParser would drop or rewrite several of those).
 */

type Tok =
  | { t: 'open'; name: string; attrs: string; selfClose: boolean }
  | { t: 'close'; name: string }
  | { t: 'text'; raw: string }
  /** comment / CDATA / PI / doctype, copied through verbatim. `cdata` marks the
   *  ones that are character data and must therefore not be re-flowed. */
  | { t: 'raw'; raw: string; cdata: boolean }

/**
 * Collapse whitespace that sits outside quoted attribute values, so tags spread
 * over several source lines become one tidy line. Quoted values are copied
 * verbatim.
 */
export function normalizeAttrs(inner: string): string {
  let out = ''
  let quote = ''
  let pendingSpace = false
  let suppressSpace = true
  for (const ch of inner) {
    if (quote) {
      out += ch
      if (ch === quote) quote = ''
      continue
    }
    if (/\s/.test(ch)) {
      pendingSpace = true
      continue
    }
    if (ch === '=') {
      out += '='
      pendingSpace = false
      suppressSpace = true
      continue
    }
    if (pendingSpace && !suppressSpace && out) out += ' '
    pendingSpace = false
    suppressSpace = false
    if (ch === '"' || ch === "'") quote = ch
    out += ch
  }
  return out.trim()
}

export function tokenize(src: string): Tok[] {
  const toks: Tok[] = []
  let i = 0
  const n = src.length

  while (i < n) {
    if (src[i] !== '<') {
      const next = src.indexOf('<', i)
      const end = next === -1 ? n : next
      toks.push({ t: 'text', raw: src.slice(i, end) })
      i = end
      continue
    }

    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4)
      if (end === -1) throw new Error('malformed XML: unterminated comment')
      toks.push({ t: 'raw', raw: src.slice(i, end + 3), cdata: false })
      i = end + 3
      continue
    }

    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9)
      if (end === -1) throw new Error('malformed XML: unterminated CDATA section')
      toks.push({ t: 'raw', raw: src.slice(i, end + 3), cdata: true })
      i = end + 3
      continue
    }

    if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2)
      if (end === -1) throw new Error('malformed XML: unterminated processing instruction')
      toks.push({ t: 'raw', raw: src.slice(i, end + 2), cdata: false })
      i = end + 2
      continue
    }

    if (src.startsWith('<!', i)) {
      // doctype (possibly with an internal subset) or any other declaration
      let k = i + 2
      let depth = 0
      let quote = ''
      while (k < n) {
        const c = src[k]
        if (quote) {
          if (c === quote) quote = ''
        } else if (c === '"' || c === "'") quote = c
        else if (c === '[') depth++
        else if (c === ']') depth--
        else if (c === '>' && depth <= 0) break
        k++
      }
      if (k >= n) throw new Error('malformed XML: unterminated declaration')
      toks.push({ t: 'raw', raw: src.slice(i, k + 1), cdata: false })
      i = k + 1
      continue
    }

    if (src.startsWith('</', i)) {
      const end = src.indexOf('>', i + 2)
      if (end === -1) throw new Error('malformed XML: unterminated closing tag')
      const name = src.slice(i + 2, end).trim()
      if (!name) throw new Error('malformed XML: empty closing tag')
      toks.push({ t: 'close', name })
      i = end + 1
      continue
    }

    // opening tag
    let j = i + 1
    while (j < n && !/[\s/>]/.test(src[j])) j++
    const name = src.slice(i + 1, j)
    if (!name) throw new Error('malformed XML: empty tag name')

    let k = j
    let quote = ''
    while (k < n) {
      const c = src[k]
      if (quote) {
        if (c === quote) quote = ''
      } else if (c === '"' || c === "'") quote = c
      else if (c === '>') break
      k++
    }
    if (k >= n) throw new Error(`malformed XML: unterminated tag <${name}>`)

    let inner = src.slice(j, k)
    let selfClose = false
    const trimmedInner = inner.trimEnd()
    if (trimmedInner.endsWith('/')) {
      selfClose = true
      inner = trimmedInner.slice(0, -1)
    }
    toks.push({ t: 'open', name, attrs: normalizeAttrs(inner), selfClose })
    i = k + 1
  }

  return toks
}

type ElementNode = {
  type: 'element'
  name: string
  attrs: string
  children: Node[]
}
type Node =
  | ElementNode
  | { type: 'text'; raw: string }
  | { type: 'raw'; raw: string; cdata: boolean }

export function buildTree(toks: Tok[]): Node[] {
  const roots: Node[] = []
  const stack: ElementNode[] = []
  const push = (node: Node) => {
    if (stack.length) stack[stack.length - 1].children.push(node)
    else roots.push(node)
  }

  for (const tok of toks) {
    if (tok.t === 'open') {
      const el: ElementNode = { type: 'element', name: tok.name, attrs: tok.attrs, children: [] }
      push(el)
      if (!tok.selfClose) stack.push(el)
    } else if (tok.t === 'close') {
      const top = stack.pop()
      if (!top) throw new Error(`malformed XML: </${tok.name}> has no matching opening tag`)
      if (top.name !== tok.name) {
        throw new Error(`malformed XML: </${tok.name}> closes <${top.name}>`)
      }
    } else {
      push(
        tok.t === 'text'
          ? { type: 'text', raw: tok.raw }
          : { type: 'raw', raw: tok.raw, cdata: tok.cdata }
      )
    }
  }

  if (stack.length) throw new Error(`malformed XML: <${stack[stack.length - 1].name}> is never closed`)
  return roots
}

const isBlank = (node: Node) => node.type === 'text' && node.raw.trim() === ''
/** Text and CDATA are both character data: re-flowing either would edit content. */
const isCharData = (node: Node) => node.type === 'text' || (node.type === 'raw' && node.cdata)
const openTag = (el: ElementNode) => `<${el.name}${el.attrs ? ' ' + el.attrs : ''}`
/** Formatting newlines inside inline text become a single space. */
const flattenText = (raw: string) => {
  // same result as raw.replace(/[ \t]*\r?\n[ \t]*/g, ' '), which is quadratic on a long
  // run of spaces with no line break after it
  const lines = raw.split(/\r?\n/)
  const last = lines.length - 1
  return lines.map((line, i) => {
    const s = i > 0 ? line.replace(/^[ \t]+/, '') : line
    return i < last ? s.replace(/(?<![ \t])[ \t]+$/, '') : s
  }).join(' ')
}

type Opts = { indent: number; collapseEmpty: boolean }

function emptyElement(el: ElementNode, o: Opts) {
  return o.collapseEmpty ? `${openTag(el)}/>` : `${openTag(el)}></${el.name}>`
}

function renderInline(node: Node, o: Opts): string {
  if (node.type === 'text') return flattenText(node.raw)
  if (node.type === 'raw') return node.raw
  const kids = node.children.filter((c) => !isBlank(c))
  if (kids.length === 0) return emptyElement(node, o)
  return `${openTag(node)}>${kids.map((k) => renderInline(k, o)).join('')}</${node.name}>`
}

function renderNode(node: Node, depth: number, out: string[], o: Opts): void {
  const pad = o.indent > 0 ? ' '.repeat(o.indent * depth) : ''

  if (node.type === 'text') {
    const text = flattenText(node.raw).trim()
    if (text) out.push(pad + text)
    return
  }
  if (node.type === 'raw') {
    out.push(pad + node.raw)
    return
  }

  const kids = node.children.filter((c) => !isBlank(c))
  if (kids.length === 0) {
    out.push(pad + emptyElement(node, o))
    return
  }

  const hasElement = kids.some((k) => k.type === 'element')
  const hasText = kids.some(isCharData)

  // text-only or mixed content stays on a single line so words never move
  if (!hasElement || hasText) {
    const inner = kids.map((k) => renderInline(k, o)).join('').trim()
    out.push(`${pad}${openTag(node)}>${inner}</${node.name}>`)
    return
  }

  out.push(`${pad}${openTag(node)}>`)
  for (const kid of kids) renderNode(kid, depth + 1, out, o)
  out.push(`${pad}</${node.name}>`)
}

const util: Utility = {
  id: 'xml_pretty',
  name: 'xml pretty',
  category: 'Formatting',
  description:
    'Re-indent XML with a configurable indent width, optionally collapsing empty elements to self-closing tags, keeping comments and CDATA intact.',
  accepts: 'string',
  produces: 'string',
  tags: ['xml', 'format', 'indent', 'pretty print', 'beautify', 'reformat'],
  aliases: ['xmllint --format', 'tidy'],
  examples: [
    {
      title: 'indents nested elements',
      input: '<root><a>1</a><b/></root>',
      output: '<root>\n  <a>1</a>\n  <b/>\n</root>'
    }
  ],
  params: {
    indent: { kind: 'number', label: 'indent', default: 2, max: 16 },
    collapseEmpty: { kind: 'boolean', label: 'collapse empty elements', default: true }
  },
  apply: (input: any, params: any = {}) => {
    const src = typeof input === 'string' ? input : String(input ?? '')
    if (src.trim() === '') return ''

    const o: Opts = {
      indent: Math.max(0, Math.floor(Number(params.indent ?? 2)) || 0),
      collapseEmpty: params.collapseEmpty !== false
    }

    const roots = buildTree(tokenize(src)).filter((node) => !isBlank(node))
    const out: string[] = []
    for (const node of roots) renderNode(node, 0, out, o)
    return out.join('\n')
  }
}

export default util
