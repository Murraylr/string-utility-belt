import type { Utility } from '@/types/utility'

/**
 * Strips the whitespace a pretty-printer added — whitespace-only text between
 * tags, and the newline+indent runs that wrap real text — plus (optionally)
 * comments. CDATA sections, processing instructions and the doctype are copied
 * through byte for byte.
 */

type Tok =
  | { t: 'open'; name: string; attrs: string; selfClose: boolean }
  | { t: 'close'; name: string }
  | { t: 'text'; raw: string }
  | { t: 'raw'; raw: string; comment: boolean }

/**
 * Collapse whitespace that sits outside quoted attribute values, so tags spread
 * over several source lines collapse onto one. Quoted values are copied
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
      toks.push({ t: 'raw', raw: src.slice(i, end + 3), comment: true })
      i = end + 3
      continue
    }

    if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9)
      if (end === -1) throw new Error('malformed XML: unterminated CDATA section')
      toks.push({ t: 'raw', raw: src.slice(i, end + 3), comment: false })
      i = end + 3
      continue
    }

    if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2)
      if (end === -1) throw new Error('malformed XML: unterminated processing instruction')
      toks.push({ t: 'raw', raw: src.slice(i, end + 2), comment: false })
      i = end + 2
      continue
    }

    if (src.startsWith('<!', i)) {
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
      toks.push({ t: 'raw', raw: src.slice(i, k + 1), comment: false })
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

/** Verify nesting so malformed input is reported instead of silently mangled. */
function checkNesting(toks: Tok[]): void {
  const stack: string[] = []
  for (const tok of toks) {
    if (tok.t === 'open') {
      if (!tok.selfClose) stack.push(tok.name)
    } else if (tok.t === 'close') {
      const top = stack.pop()
      if (!top) throw new Error(`malformed XML: </${tok.name}> has no matching opening tag`)
      if (top !== tok.name) throw new Error(`malformed XML: </${tok.name}> closes <${top}>`)
    }
  }
  if (stack.length) throw new Error(`malformed XML: <${stack[stack.length - 1]}> is never closed`)
}

const LEADING_BREAK = /^[ \t]*\r?\n\s*/
// the lookbehind lets a match start only where a whitespace run starts: linear, same match
const TRAILING_BREAK = /(?<!\s)\s*\r?\n[ \t]*$/

/**
 * Drop indentation whitespace without eating spaces that are part of the text.
 *
 * Only whitespace runs containing a line break are touched, and what happens to
 * them depends on what sits next to the text:
 *  - against the parent's own tags (`<desc>\n  text\n</desc>`) the run is pure
 *    indentation and is removed;
 *  - against a sibling node (`Hello\n<b>x</b>\nworld`) the line break separates
 *    words, so it collapses to a single space instead of gluing them together.
 */
export const squeezeText = (raw: string, afterOpen: boolean, beforeClose: boolean): string => {
  if (raw.trim() === '') return ''
  let out = raw
  const lead = LEADING_BREAK.exec(out)
  if (lead) out = (afterOpen ? '' : ' ') + out.slice(lead[0].length)
  const trail = TRAILING_BREAK.exec(out)
  if (trail) out = out.slice(0, out.length - trail[0].length) + (beforeClose ? '' : ' ')
  return out
}

const util: Utility = {
  id: 'xml_minify',
  name: 'xml minify',
  category: 'Formatting',
  description:
    'Minify XML by removing whitespace-only text between tags, indentation around text, and (optionally) comments.',
  accepts: 'string',
  produces: 'string',
  tags: ['xml', 'minify', 'compress', 'whitespace', 'compact', 'strip whitespace'],
  aliases: ['xmllint --noblanks'],
  examples: [
    {
      title: 'strips indentation whitespace',
      input: '<root>\n  <item>value</item>\n</root>',
      output: '<root><item>value</item></root>'
    },
    {
      title: 'removes comments',
      input: '<a>\n  <!-- note -->\n  <b>1</b>\n</a>',
      output: '<a><b>1</b></a>'
    }
  ],
  params: {
    removeComments: { kind: 'boolean', label: 'remove comments', default: true }
  },
  apply: (input: any, params: any = {}) => {
    const src = typeof input === 'string' ? input : String(input ?? '')
    if (src.trim() === '') return ''

    const removeComments = params.removeComments !== false
    const toks = tokenize(src)
    checkNesting(toks)

    let out = ''
    for (let i = 0; i < toks.length; i++) {
      const tok = toks[i]
      if (tok.t === 'open') {
        out += `<${tok.name}${tok.attrs ? ' ' + tok.attrs : ''}${tok.selfClose ? '/>' : '>'}`
      } else if (tok.t === 'close') {
        out += `</${tok.name}>`
      } else if (tok.t === 'text') {
        const prev = toks[i - 1]
        const next = toks[i + 1]
        const afterOpen = !prev || (prev.t === 'open' && !prev.selfClose)
        const beforeClose = !next || next.t === 'close'
        out += squeezeText(tok.raw, afterOpen, beforeClose)
      } else if (!tok.comment || !removeComments) {
        out += tok.raw
      }
    }
    return out
  }
}

export default util
