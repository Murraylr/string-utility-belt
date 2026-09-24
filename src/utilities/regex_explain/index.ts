import type { Utility } from '@/types/utility'

export type RxNode = {
  type: string
  token: string
  raw: string
  description: string
  quantifier?: string
  children?: RxNode[]
}

type State = {
  chars: string[]
  i: number
  groupCount: number
  groups: { number: number; name: string }[]
}

const FLAG_MEANINGS: Record<string, string> = {
  d: 'hasIndices — match results carry the start/end index of every group',
  g: 'global — find every match, not just the first',
  i: 'ignore case',
  m: 'multiline — ^ and $ also match at line breaks',
  s: 'dotAll — . also matches line breaks',
  u: 'unicode — full code-point matching, \\u{…} and \\p{…} escapes',
  v: 'unicodeSets — the extended character-class syntax',
  y: 'sticky — match only at the current lastIndex'
}

const CONTROL_NAMES: Record<string, string> = {
  ' ': 'a space',
  '\t': 'a tab',
  '\n': 'a line feed',
  '\r': 'a carriage return',
  '\f': 'a form feed',
  '\v': 'a vertical tab'
}

const quoted = (ch: string) => CONTROL_NAMES[ch] ?? `"${ch}"`
const describeLiteralChar = (ch: string) =>
  CONTROL_NAMES[ch] ? CONTROL_NAMES[ch] : `the character "${ch}"`

const joinList = (items: string[]): string => {
  if (items.length <= 1) return items[0] ?? ''
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

const codePointNote = (cp: number): string => {
  const hex = cp.toString(16).toUpperCase().padStart(4, '0')
  const printable = cp >= 0x20 && cp !== 0x7f
  return printable ? `U+${hex} ("${String.fromCodePoint(cp)}")` : `U+${hex}`
}

const isHex = (ch: string | undefined) => ch !== undefined && /^[0-9a-fA-F]$/.test(ch)

type Piece = { type: string; token: string; description: string }

/** Read one `\x` escape. Assumes the cursor sits on the backslash. */
function readEscape(st: State, inClass: boolean): Piece {
  st.i++
  const c = st.chars[st.i]
  if (c === undefined) throw new Error('the pattern ends with a dangling backslash')
  st.i++

  switch (c) {
    case 'd':
      return { type: 'shorthand', token: '\\d', description: 'any digit (0-9)' }
    case 'D':
      return { type: 'shorthand', token: '\\D', description: 'any character that is not a digit' }
    case 'w':
      return {
        type: 'shorthand',
        token: '\\w',
        description: 'any word character (letter, digit or underscore)'
      }
    case 'W':
      return {
        type: 'shorthand',
        token: '\\W',
        description: 'any character that is not a letter, digit or underscore'
      }
    case 's':
      return {
        type: 'shorthand',
        token: '\\s',
        description: 'any whitespace character (space, tab, line break, …)'
      }
    case 'S':
      return { type: 'shorthand', token: '\\S', description: 'any character that is not whitespace' }
    case 'n':
      return { type: 'escaped_char', token: '\\n', description: 'a line feed (newline)' }
    case 'r':
      return { type: 'escaped_char', token: '\\r', description: 'a carriage return' }
    case 't':
      return { type: 'escaped_char', token: '\\t', description: 'a tab' }
    case 'f':
      return { type: 'escaped_char', token: '\\f', description: 'a form feed' }
    case 'v':
      return { type: 'escaped_char', token: '\\v', description: 'a vertical tab' }
    case '0':
      return { type: 'escaped_char', token: '\\0', description: 'a NUL character (U+0000)' }
    default:
      break
  }

  if (c === 'b') {
    return inClass
      ? { type: 'escaped_char', token: '\\b', description: 'a backspace character (U+0008)' }
      : { type: 'anchor', token: '\\b', description: 'a word boundary' }
  }
  if (c === 'B' && !inClass) {
    return { type: 'anchor', token: '\\B', description: 'a position that is NOT a word boundary' }
  }

  if (c === 'x') {
    const a = st.chars[st.i]
    const b = st.chars[st.i + 1]
    if (!isHex(a) || !isHex(b)) throw new Error('\\x must be followed by two hex digits')
    st.i += 2
    const cp = parseInt(`${a}${b}`, 16)
    return { type: 'escaped_char', token: `\\x${a}${b}`, description: `the character ${codePointNote(cp)}` }
  }

  if (c === 'u') {
    if (st.chars[st.i] === '{') {
      let j = st.i + 1
      let digits = ''
      while (j < st.chars.length && st.chars[j] !== '}') {
        digits += st.chars[j]
        j++
      }
      if (st.chars[j] !== '}' || !/^[0-9a-fA-F]+$/.test(digits)) {
        throw new Error('\\u{…} must contain hex digits and a closing brace')
      }
      st.i = j + 1
      return {
        type: 'escaped_char',
        token: `\\u{${digits}}`,
        description: `the character ${codePointNote(parseInt(digits, 16))}`
      }
    }
    const digits = st.chars.slice(st.i, st.i + 4).join('')
    if (!/^[0-9a-fA-F]{4}$/.test(digits)) throw new Error('\\u must be followed by four hex digits')
    st.i += 4
    return {
      type: 'escaped_char',
      token: `\\u${digits}`,
      description: `the character ${codePointNote(parseInt(digits, 16))}`
    }
  }

  if (c === 'c') {
    const letter = st.chars[st.i]
    if (letter === undefined || !/^[a-zA-Z]$/.test(letter)) {
      throw new Error('\\c must be followed by a letter')
    }
    st.i++
    const cp = letter.toUpperCase().charCodeAt(0) - 64
    return {
      type: 'escaped_char',
      token: `\\c${letter}`,
      description: `the control character Ctrl-${letter.toUpperCase()} (${codePointNote(cp)})`
    }
  }

  if (c === 'p' || c === 'P') {
    if (st.chars[st.i] !== '{') throw new Error(`\\${c} must be followed by {…}`)
    let j = st.i + 1
    let name = ''
    while (j < st.chars.length && st.chars[j] !== '}') {
      name += st.chars[j]
      j++
    }
    if (st.chars[j] !== '}') throw new Error(`unterminated \\${c}{…} property escape`)
    st.i = j + 1
    return {
      type: 'unicode_property',
      token: `\\${c}{${name}}`,
      description:
        c === 'p'
          ? `any character with the Unicode property ${name} (needs the u or v flag)`
          : `any character WITHOUT the Unicode property ${name} (needs the u or v flag)`
    }
  }

  if (c === 'k' && !inClass) {
    if (st.chars[st.i] !== '<') throw new Error('\\k must be followed by <name>')
    let j = st.i + 1
    let name = ''
    while (j < st.chars.length && st.chars[j] !== '>') {
      name += st.chars[j]
      j++
    }
    if (st.chars[j] !== '>') throw new Error('unterminated named back-reference \\k<…>')
    st.i = j + 1
    return {
      type: 'backreference',
      token: `\\k<${name}>`,
      description: `the same text that the group named "${name}" matched`
    }
  }

  if (!inClass && /^[1-9]$/.test(c)) {
    let digits = c
    while (st.i < st.chars.length && /^[0-9]$/.test(st.chars[st.i])) {
      digits += st.chars[st.i]
      st.i++
    }
    return {
      type: 'backreference',
      token: `\\${digits}`,
      description: `the same text that capturing group ${digits} matched`
    }
  }

  return { type: 'escaped_char', token: `\\${c}`, description: `the literal character "${c}"` }
}

const rangeLabel = (a: string, b: string): string => {
  if (/^[0-9]$/.test(a) && /^[0-9]$/.test(b)) return `"${a}"-"${b}" (digits)`
  if (/^[a-z]$/.test(a) && /^[a-z]$/.test(b)) return `"${a}"-"${b}" (lowercase letters)`
  if (/^[A-Z]$/.test(a) && /^[A-Z]$/.test(b)) return `"${a}"-"${b}" (uppercase letters)`
  return `"${a}"-"${b}"`
}

function parseCharClass(st: State): RxNode {
  const start = st.i
  st.i++ // '['
  let negated = false
  if (st.chars[st.i] === '^') {
    negated = true
    st.i++
  }
  const labels: string[] = []
  let closed = false
  while (st.i < st.chars.length) {
    if (st.chars[st.i] === ']') {
      st.i++
      closed = true
      break
    }
    const c = st.chars[st.i]
    let a: Piece
    if (c === '\\') {
      a = readEscape(st, true)
    } else {
      st.i++
      a = { type: 'char', token: c, description: describeLiteralChar(c) }
    }
    const canRange = a.type === 'char' || a.type === 'escaped_char'
    if (canRange && st.chars[st.i] === '-' && st.chars[st.i + 1] !== undefined && st.chars[st.i + 1] !== ']') {
      st.i++ // '-'
      const c2 = st.chars[st.i]
      let b: Piece
      if (c2 === '\\') {
        b = readEscape(st, true)
      } else {
        st.i++
        b = { type: 'char', token: c2, description: describeLiteralChar(c2) }
      }
      labels.push(rangeLabel(a.token, b.token))
    } else if (a.type === 'char') {
      labels.push(quoted(a.token))
    } else {
      labels.push(a.description)
    }
  }
  if (!closed) throw new Error('unterminated character class: the "[" has no matching "]"')
  const raw = st.chars.slice(start, st.i).join('')
  let description: string
  if (!labels.length) {
    description = negated
      ? 'any character at all (an empty negated class)'
      : 'an empty character class, which never matches'
  } else {
    description = `${negated ? 'any one character NOT in the set' : 'any one character in the set'}: ${joinList(labels)}`
  }
  return { type: negated ? 'negated_character_class' : 'character_class', token: raw, raw, description }
}

function parseGroup(st: State): RxNode {
  const start = st.i
  st.i++ // '('
  let type = 'capturing_group'
  let token = '( … )'
  let description = ''

  if (st.chars[st.i] === '?') {
    const c2 = st.chars[st.i + 1]
    const c3 = st.chars[st.i + 2]
    if (c2 === ':') {
      st.i += 2
      type = 'non_capturing_group'
      token = '(?: … )'
      description = 'a group that is NOT captured (used only for grouping)'
    } else if (c2 === '=') {
      st.i += 2
      type = 'lookahead'
      token = '(?= … )'
      description = 'positive lookahead — what follows must match here, but is not consumed'
    } else if (c2 === '!') {
      st.i += 2
      type = 'negative_lookahead'
      token = '(?! … )'
      description = 'negative lookahead — what follows must NOT match here'
    } else if (c2 === '<' && c3 === '=') {
      st.i += 3
      type = 'lookbehind'
      token = '(?<= … )'
      description = 'positive lookbehind — the text just before must match this, and is not consumed'
    } else if (c2 === '<' && c3 === '!') {
      st.i += 3
      type = 'negative_lookbehind'
      token = '(?<! … )'
      description = 'negative lookbehind — the text just before must NOT match this'
    } else if (c2 === '<') {
      let j = st.i + 2
      let name = ''
      while (j < st.chars.length && st.chars[j] !== '>') {
        name += st.chars[j]
        j++
      }
      if (st.chars[j] !== '>') throw new Error('unterminated group name: "(?<" has no matching ">"')
      if (!name) throw new Error('a named group needs a name: "(?<>" is not valid')
      st.i = j + 1
      const number = ++st.groupCount
      st.groups.push({ number, name })
      type = 'named_capturing_group'
      token = `(?<${name}> … )`
      description = `capturing group ${number}, named "${name}"`
    } else {
      let j = st.i + 1
      let mods = ''
      while (j < st.chars.length && /^[a-zA-Z-]$/.test(st.chars[j])) {
        mods += st.chars[j]
        j++
      }
      if (st.chars[j] !== ':' || !mods) {
        throw new Error(`unsupported group syntax "(?${mods || st.chars[st.i + 1] || ''}"`)
      }
      st.i = j + 1
      type = 'modifier_group'
      token = `(?${mods}: … )`
      description = `a group with the flag modifier "${mods}" applied to it`
    }
  } else {
    const number = ++st.groupCount
    st.groups.push({ number, name: '' })
    description = `capturing group ${number}`
  }

  const children = parseAlternation(st)
  if (st.chars[st.i] !== ')') throw new Error('unterminated group: the "(" has no matching ")"')
  st.i++
  const raw = st.chars.slice(start, st.i).join('')
  return { type, token, raw, description, children }
}

function readQuantifier(st: State): { token: string; description: string } | null {
  const c = st.chars[st.i]
  let base = ''
  let description = ''
  let openEnded = false

  if (c === '*') {
    base = '*'
    description = 'repeated zero or more times'
    openEnded = true
    st.i++
  } else if (c === '+') {
    base = '+'
    description = 'repeated one or more times'
    openEnded = true
    st.i++
  } else if (c === '?') {
    base = '?'
    description = 'optional (zero or one time)'
    st.i++
  } else if (c === '{') {
    let j = st.i + 1
    let body = ''
    // only digits and a comma can form a {n,m} body: stop at anything else rather
    // than scanning to a far-off "}" for every "{" (quadratic on "{{{{…")
    while (j < st.chars.length && st.chars[j] !== '}' && /[\d,]/.test(st.chars[j])) {
      body += st.chars[j]
      j++
    }
    if (st.chars[j] !== '}') return null
    const m = /^(\d+)(,(\d*))?$/.exec(body)
    if (!m) return null
    const min = Number(m[1])
    base = `{${body}}`
    if (!m[2]) {
      description = `repeated exactly ${min} ${min === 1 ? 'time' : 'times'}`
    } else if (m[3] === '') {
      description = `repeated ${min} or more times`
      openEnded = true
    } else {
      const max = Number(m[3])
      if (max < min) throw new Error(`invalid quantifier {${body}}: the maximum is below the minimum`)
      description = `repeated between ${min} and ${max} times`
      openEnded = max > min
    }
    st.i = j + 1
  } else {
    return null
  }

  let modifier = ''
  if (st.chars[st.i] === '?') {
    modifier = '?'
    description += ', as few as possible (lazy)'
    st.i++
  } else if (st.chars[st.i] === '+') {
    modifier = '+'
    description += ', possessive — never gives characters back'
    st.i++
  } else if (openEnded) {
    description += ', as many as possible (greedy)'
  }
  return { token: base + modifier, description }
}

function parseAtom(st: State): RxNode {
  const start = st.i
  const c = st.chars[st.i]
  if (c === '(') return parseGroup(st)
  if (c === '[') return parseCharClass(st)
  if (c === '\\') {
    const e = readEscape(st, false)
    return { type: e.type, token: e.token, raw: st.chars.slice(start, st.i).join(''), description: e.description }
  }
  if (c === '.') {
    st.i++
    return {
      type: 'dot',
      token: '.',
      raw: '.',
      description: 'any character except a line break (any character at all with the s flag)'
    }
  }
  if (c === '^') {
    st.i++
    return {
      type: 'anchor',
      token: '^',
      raw: '^',
      description: 'the start of the string (or of a line when the m flag is set)'
    }
  }
  if (c === '$') {
    st.i++
    return {
      type: 'anchor',
      token: '$',
      raw: '$',
      description: 'the end of the string (or of a line when the m flag is set)'
    }
  }
  if (c === '*' || c === '+' || c === '?') throw new Error(`nothing to repeat before "${c}"`)
  if (c === ')') throw new Error('unmatched ")" in the pattern')
  st.i++
  return { type: 'literal', token: c, raw: c, description: describeLiteralChar(c) }
}

/** Fold runs of plain literal characters into one "the literal text …" node. */
function mergeLiterals(nodes: RxNode[]): RxNode[] {
  const out: RxNode[] = []
  for (const node of nodes) {
    const prev = out[out.length - 1]
    if (node.type === 'literal' && !node.quantifier && prev && prev.type === 'literal' && !prev.quantifier) {
      const text = prev.token + node.token
      out[out.length - 1] = {
        type: 'literal',
        token: text,
        raw: prev.raw + node.raw,
        description: `the literal text "${text}"`
      }
    } else {
      out.push(node)
    }
  }
  return out
}

function parseSequence(st: State): RxNode[] {
  const nodes: RxNode[] = []
  while (st.i < st.chars.length && st.chars[st.i] !== '|' && st.chars[st.i] !== ')') {
    const start = st.i
    const node = parseAtom(st)
    const q = readQuantifier(st)
    if (q) {
      node.quantifier = q.token
      node.token = `${node.token}${q.token}`
      node.description = `${node.description}, ${q.description}`
    }
    node.raw = st.chars.slice(start, st.i).join('')
    nodes.push(node)
  }
  return mergeLiterals(nodes)
}

function parseAlternation(st: State): RxNode[] {
  const start = st.i
  const branches: RxNode[][] = [parseSequence(st)]
  while (st.chars[st.i] === '|') {
    st.i++
    branches.push(parseSequence(st))
  }
  if (branches.length === 1) return branches[0]
  const raw = st.chars.slice(start, st.i).join('')
  return [
    {
      type: 'alternation',
      token: '|',
      raw,
      description: `match any ONE of these ${branches.length} alternatives`,
      children: branches.map((branch, index) => ({
        type: 'alternative',
        token: `option ${index + 1}`,
        raw: branch.map((n) => n.raw).join(''),
        description: branch.length ? '' : 'matches the empty string',
        children: branch
      }))
    }
  ]
}

/** Parse a regex source string into an explanation tree. Throws on structural errors. */
export function parsePattern(pattern: string): { tree: RxNode[]; groups: { number: number; name: string }[] } {
  const st: State = { chars: Array.from(pattern), i: 0, groupCount: 0, groups: [] }
  const tree = parseAlternation(st)
  if (st.i < st.chars.length) throw new Error('unmatched ")" in the pattern')
  return { tree, groups: st.groups }
}

type Row = { indent: number; token: string; description: string }

const collect = (nodes: RxNode[], depth: number, rows: Row[]) => {
  for (const node of nodes) {
    rows.push({ indent: depth, token: node.token, description: node.description })
    if (node.children?.length) collect(node.children, depth + 1, rows)
  }
}

function renderTree(pattern: string, flags: string, tree: RxNode[], groups: { number: number; name: string }[]) {
  const rows: Row[] = []
  collect(tree, 0, rows)
  const width = rows.reduce((w, r) => Math.max(w, r.indent * 2 + r.token.length), 0)
  const body = rows
    .map((r) => {
      const left = `${'  '.repeat(r.indent)}${r.token}`
      return r.description ? `${left.padEnd(width)}  —  ${r.description}` : left
    })
    .join('\n')

  const flagLine = flags
    ? Array.from(flags)
        .map((f) => `${f} = ${FLAG_MEANINGS[f]}`)
        .join('\n           ')
    : '(none)'
  const head = [`pattern:   /${pattern}/${flags}`, `flags:     ${flagLine}`].join('\n')
  const tail = groups.length
    ? `\n\ncapture groups: ${groups
        .map((g) => (g.name ? `${g.number} ("${g.name}")` : String(g.number)))
        .join(', ')}`
    : ''
  return `${head}\n\n${body}${tail}`
}

const util: Utility = {
  id: 'regex_explain',
  name: 'regex explain',
  category: 'Analysis',
  description:
    'Explain a regular expression token by token in plain English, as an indented tree or as JSON, using the pattern param or the input itself (a /pattern/flags literal is understood).',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['regex101', 'explain regex', 'regex documentation', 'pattern breakdown', 'regexp tutor'],
  aliases: ['regex101'],
  params: {
    pattern: {
      kind: 'regex',
      label: 'pattern (blank = use the input)',
      default: '',
      placeholder: '^(\\d{4})-(\\d{2})$',
      flagsParam: 'flags'
    },
    flags: { kind: 'string', label: 'flags', default: '', placeholder: 'gim' },
    format: { kind: 'select', label: 'output', options: ['tree', 'json'], default: 'tree' }
  },
  examples: [
    {
      title: 'a date-like pattern',
      input: '',
      params: { pattern: '^(\\d{4})-(\\d{2})$' },
      output:
        'pattern:   /^(\\d{4})-(\\d{2})$/\n' +
        'flags:     (none)\n' +
        '\n' +
        '^        —  the start of the string (or of a line when the m flag is set)\n' +
        '( … )    —  capturing group 1\n' +
        '  \\d{4}  —  any digit (0-9), repeated exactly 4 times\n' +
        '-        —  the character "-"\n' +
        '( … )    —  capturing group 2\n' +
        '  \\d{2}  —  any digit (0-9), repeated exactly 2 times\n' +
        '$        —  the end of the string (or of a line when the m flag is set)\n' +
        '\n' +
        'capture groups: 1, 2'
    }
  ],
  apply: (input: any, params: any = {}) => {
    const format = String(params.format || 'tree')
    let pattern = String(params.pattern ?? '')
    let flags = String(params.flags ?? '').trim()

    if (!pattern) {
      // the lookbehind lets the trailing match start only where a run starts (linear)
      const text = String(input ?? '').replace(/^[\r\n]+|(?<![\r\n])[\r\n]+$/g, '')
      const end = text.lastIndexOf('/')
      if (text.startsWith('/') && end > 0 && /^[dgimsuvy]*$/.test(text.slice(end + 1))) {
        pattern = text.slice(1, end)
        if (!flags) flags = text.slice(end + 1)
      } else {
        pattern = text
      }
    }

    if (!pattern) return format === 'json' ? {} : ''

    const seen = new Set<string>()
    for (const f of Array.from(flags)) {
      if (!FLAG_MEANINGS[f]) throw new Error(`unknown regex flag "${f}"`)
      if (seen.has(f)) throw new Error(`duplicate regex flag "${f}"`)
      seen.add(f)
    }

    const { tree, groups } = parsePattern(pattern)

    if (format === 'json') {
      return {
        pattern,
        flags,
        flagDescriptions: Array.from(flags).map((f) => ({ flag: f, meaning: FLAG_MEANINGS[f] })),
        groupCount: groups.length,
        groups,
        tree
      } as any
    }

    return renderTree(pattern, flags, tree, groups)
  }
}

export default util
