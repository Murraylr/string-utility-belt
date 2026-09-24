import type { Utility } from '@/types/utility'

type RepTok =
  | { t: 'lit'; v: string }
  | { t: 'group'; n: number }
  | { t: 'case'; v: 'U' | 'L' | 'u' | 'l' | 'E' }

type Address =
  | { kind: 'none' }
  | { kind: 're'; re: RegExp }
  | { kind: 'line'; n: number }
  | { kind: 'last' }
  | { kind: 'range'; from: number; to: number } // to === 0 means "$"

type Base = { addr: Address; negate: boolean }

export type Command =
  | (Base & {
      cmd: 's'
      /** Compiled once with `g` so a long input does not recompile it per line. */
      re: RegExp
      rep: RepTok[]
      global: boolean
      nth: number
      print: boolean
    })
  | (Base & { cmd: 'y'; map: Map<string, string> })
  | (Base & { cmd: 'd' })
  | (Base & { cmd: 'p' })

/** Characters that must stay backslash-escaped when the sed delimiter is
 *  unescaped back into a JavaScript regex source. */
const REGEX_META = '^$.*+?()[]{}|/\\'

/** Trailing whitespace and `;` separators are ignored after a command, the
 *  way sed ignores them. */
const trimTail = (s: string): string => s.trim().replace(/[\s;]+$/, '')

/** Number of capture groups in a compiled pattern, or -1 when it cannot be
 *  determined. Appending an empty alternative makes the probe always match. */
function countGroups(re: RegExp): number {
  try {
    const m = new RegExp(`${re.source}|`, re.flags.replace(/[gy]/g, '')).exec('')
    return m ? m.length - 1 : -1
  } catch {
    return -1
  }
}

/** Prefer unicode mode so astral characters behave, but fall back for
 *  patterns that are only legal without the `u` flag. */
function compileRegex(source: string, flags: string, lineNo: number): RegExp {
  const uniq = Array.from(new Set(flags)).join('')
  try {
    return new RegExp(source, uniq + 'u')
  } catch {
    try {
      return new RegExp(source, uniq)
    } catch (err) {
      throw new Error(`sed: invalid regex on script line ${lineNo}: ${(err as Error).message}`)
    }
  }
}

/** Split `count` delimiter-separated fields starting at `start`, honouring
 *  backslash escapes so `s/a\/b/c/` works. Escapes are left intact. */
function splitDelimited(src: string, start: number, delim: string, count: number, lineNo: number, cmd: string) {
  const parts: string[] = []
  let cur = ''
  let i = start
  while (parts.length < count) {
    if (i >= src.length) throw new Error(`sed: unterminated "${cmd}" command on script line ${lineNo}`)
    const c = src[i]
    if (c === '\\' && i + 1 < src.length) {
      cur += c + src[i + 1]
      i += 2
      continue
    }
    if (c === delim) {
      parts.push(cur)
      cur = ''
      i++
      continue
    }
    cur += c
    i++
  }
  return { parts, end: i }
}

/** Turn a sed pattern field into a JavaScript regex source. */
function patternSource(p: string, delim: string): string {
  const keep = REGEX_META.indexOf(delim) >= 0
  let out = ''
  for (let i = 0; i < p.length; i++) {
    if (p[i] === '\\' && p[i + 1] === delim) {
      out += keep ? '\\' + delim : delim
      i++
      continue
    }
    out += p[i]
  }
  return out
}

/** Resolve plain backslash escapes (used by `y` sets). */
function unescapePlain(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '\\' || i + 1 >= s.length) {
      out += c
      continue
    }
    const n = s[i + 1]
    i++
    if (n === 'n') out += '\n'
    else if (n === 't') out += '\t'
    else if (n === 'r') out += '\r'
    else if (n === 'f') out += '\f'
    else if (n === 'v') out += '\v'
    else out += n
  }
  return out
}

/** Tokenise an `s` replacement: `&`, `\1`-`\9`, escapes and \U \L \u \l \E. */
function parseReplacement(rep: string): RepTok[] {
  const toks: RepTok[] = []
  const lit = (v: string) => {
    const last = toks[toks.length - 1]
    if (last && last.t === 'lit') last.v += v
    else toks.push({ t: 'lit', v })
  }
  for (let i = 0; i < rep.length; i++) {
    const c = rep[i]
    if (c === '&') {
      toks.push({ t: 'group', n: 0 })
      continue
    }
    if (c !== '\\') {
      lit(c)
      continue
    }
    const n = rep[i + 1]
    if (n === undefined) {
      lit('\\')
      continue
    }
    i++
    if (n >= '0' && n <= '9') toks.push({ t: 'group', n: Number(n) })
    else if (n === 'n') lit('\n')
    else if (n === 't') lit('\t')
    else if (n === 'r') lit('\r')
    else if (n === 'f') lit('\f')
    else if (n === 'v') lit('\v')
    else if (n === 'U' || n === 'L' || n === 'u' || n === 'l' || n === 'E') toks.push({ t: 'case', v: n })
    else lit(n)
  }
  return toks
}

function buildReplacement(toks: RepTok[], m: RegExpExecArray): string {
  let out = ''
  let mode: 'U' | 'L' | null = null
  let once: 'u' | 'l' | null = null
  const emit = (str: string) => {
    for (const ch of str) {
      if (once) {
        out += once === 'u' ? ch.toUpperCase() : ch.toLowerCase()
        once = null
        continue
      }
      if (mode) {
        out += mode === 'U' ? ch.toUpperCase() : ch.toLowerCase()
        continue
      }
      out += ch
    }
  }
  for (const t of toks) {
    if (t.t === 'lit') emit(t.v)
    else if (t.t === 'group') emit(m[t.n] ?? '')
    else if (t.v === 'E') {
      mode = null
      once = null
    } else if (t.v === 'U' || t.v === 'L') {
      mode = t.v
      once = null
    } else once = t.v
  }
  return out
}

function parseAddress(src: string, start: number, lineNo: number): { addr: Address; i: number } {
  const c = src[start]
  if (c === '/') {
    const { parts, end } = splitDelimited(src, start + 1, '/', 1, lineNo, 'address')
    if (!parts[0]) throw new Error(`sed: empty address regex on script line ${lineNo}`)
    let j = end
    let flags = ''
    while (src[j] === 'I' || src[j] === 'M') {
      flags += src[j] === 'I' ? 'i' : 'm'
      j++
    }
    return { addr: { kind: 're', re: compileRegex(patternSource(parts[0], '/'), flags, lineNo) }, i: j }
  }
  if (c === '$') return { addr: { kind: 'last' }, i: start + 1 }
  if (c !== undefined && c >= '0' && c <= '9') {
    const m = /^\d+/.exec(src.slice(start))
    const first = m ? m[0] : '0'
    const j = start + first.length
    if (src[j] === ',') {
      const rest = src.slice(j + 1)
      if (rest[0] === '$') return { addr: { kind: 'range', from: Number(first), to: 0 }, i: j + 2 }
      const m2 = /^\d+/.exec(rest)
      if (!m2) throw new Error(`sed: invalid address range on script line ${lineNo}`)
      return { addr: { kind: 'range', from: Number(first), to: Number(m2[0]) }, i: j + 1 + m2[0].length }
    }
    return { addr: { kind: 'line', n: Number(first) }, i: j }
  }
  return { addr: { kind: 'none' }, i: start }
}

export function parseScript(script: string): Command[] {
  const cmds: Command[] = []
  const lines = String(script ?? '').split('\n')
  for (let li = 0; li < lines.length; li++) {
    const lineNo = li + 1
    const src = lines[li].replace(/\r$/, '').trim()
    if (!src || src.startsWith('#')) continue

    const parsed = parseAddress(src, 0, lineNo)
    const addr = parsed.addr
    let i = parsed.i
    while (src[i] === ' ' || src[i] === '\t') i++
    let negate = false
    while (src[i] === '!') {
      negate = !negate
      i++
      while (src[i] === ' ' || src[i] === '\t') i++
    }

    const cmd = src[i]
    if (cmd === undefined) throw new Error(`sed: missing command on script line ${lineNo}`)
    if (negate && addr.kind === 'none') {
      throw new Error(`sed: "!" needs an address before it on script line ${lineNo}`)
    }
    i++

    if (cmd === 's' || cmd === 'y') {
      const delim = src[i]
      if (delim === undefined) throw new Error(`sed: "${cmd}" needs a delimiter on script line ${lineNo}`)
      if (delim === '\\') throw new Error(`sed: "\\" cannot be a delimiter (script line ${lineNo})`)
      const { parts, end } = splitDelimited(src, i + 1, delim, 2, lineNo, cmd)

      if (cmd === 'y') {
        const from = Array.from(unescapePlain(parts[0]))
        const to = Array.from(unescapePlain(parts[1]))
        if (from.length !== to.length) {
          throw new Error(
            `sed: "y" sets must be the same length on script line ${lineNo} (${from.length} vs ${to.length})`
          )
        }
        const trailing = trimTail(src.slice(end))
        if (trailing) throw new Error(`sed: unexpected "${trailing}" after "y" on script line ${lineNo}`)
        const map = new Map<string, string>()
        for (let k = 0; k < from.length; k++) map.set(from[k], to[k])
        cmds.push({ cmd: 'y', addr, negate, map })
        continue
      }

      if (!parts[0]) throw new Error(`sed: empty pattern in "s" on script line ${lineNo}`)
      let global = false
      let print = false
      let digits = ''
      let flags = ''
      for (const f of trimTail(src.slice(end))) {
        if (f >= '0' && f <= '9') digits += f
        else if (f === 'g') global = true
        else if (f === 'p') print = true
        else if (f === 'i' || f === 'I') flags += 'i'
        else if (f === 'm' || f === 'M') flags += 'm'
        else if (f === 's') flags += 's'
        else throw new Error(`sed: unknown "s" flag "${f}" on script line ${lineNo}`)
      }
      const base = compileRegex(patternSource(parts[0], delim), flags, lineNo)
      const re = new RegExp(base.source, base.flags + 'g')
      const rep = parseReplacement(parts[1])
      const groups = countGroups(re)
      if (groups >= 0) {
        for (const t of rep) {
          if (t.t === 'group' && t.n > groups) {
            throw new Error(
              `sed: invalid reference \\${t.n} in the replacement on script line ${lineNo} ` +
                `(the pattern has ${groups} capture group${groups === 1 ? '' : 's'})`
            )
          }
        }
      }
      cmds.push({
        cmd: 's',
        addr,
        negate,
        re,
        rep,
        global,
        nth: digits ? Number(digits) : 0,
        print
      })
      continue
    }

    if (cmd === 'd' || cmd === 'p') {
      const trailing = trimTail(src.slice(i))
      if (trailing) throw new Error(`sed: unexpected "${trailing}" after "${cmd}" on script line ${lineNo}`)
      cmds.push(cmd === 'd' ? { cmd: 'd', addr, negate } : { cmd: 'p', addr, negate })
      continue
    }

    throw new Error(`sed: unknown command "${cmd}" on script line ${lineNo}`)
  }
  return cmds
}

/** Step `lastIndex` past one whole code point (never splitting a surrogate
 *  pair). Returns false once the end of the text is reached. */
function advance(re: RegExp, text: string): boolean {
  const cp = text.codePointAt(re.lastIndex)
  if (cp === undefined) return false
  re.lastIndex += String.fromCodePoint(cp).length
  return true
}

function substitute(text: string, c: Extract<Command, { cmd: 's' }>): { text: string; changed: boolean } {
  const g = c.re
  g.lastIndex = 0
  let out = ''
  let last = 0
  let count = 0
  let changed = false
  let prevEnd = -1
  let m: RegExpExecArray | null
  while ((m = g.exec(text)) !== null) {
    const empty = m[0].length === 0
    // sed (unlike String.replaceAll) does not take an empty match sitting at the
    // end of the previous match, so `s/a*/-/g` on "aaa" is "-", not "--".
    if (empty && m.index === prevEnd) {
      if (!advance(g, text)) break
      continue
    }
    count++
    const want = c.nth > 0 ? (c.global ? count >= c.nth : count === c.nth) : c.global || count === 1
    if (want) {
      out += text.slice(last, m.index) + buildReplacement(c.rep, m)
      last = m.index + m[0].length
      changed = true
    }
    prevEnd = m.index + m[0].length
    if (want && !c.global) break
    if (empty && !advance(g, text)) break
  }
  return { text: out + text.slice(last), changed }
}

function addressMatches(c: Command, ps: string, n: number, last: number): boolean {
  const addr = c.addr
  let hit = true
  if (addr.kind === 're') {
    addr.re.lastIndex = 0
    hit = addr.re.test(ps)
  } else if (addr.kind === 'line') hit = n === addr.n
  else if (addr.kind === 'last') hit = n === last
  else if (addr.kind === 'range') hit = n >= addr.from && (addr.to === 0 || n <= addr.to)
  return c.negate ? !hit : hit
}

/** Run the whole script over one pattern space, returning what sed would
 *  print for it (auto-print plus any explicit `p`). */
function runCommands(cmds: Command[], line: string, n: number, last: number): string[] {
  let ps = line
  const out: string[] = []
  let deleted = false
  for (const c of cmds) {
    if (!addressMatches(c, ps, n, last)) continue
    if (c.cmd === 's') {
      const r = substitute(ps, c)
      ps = r.text
      if (r.changed && c.print) out.push(ps)
    } else if (c.cmd === 'y') {
      ps = Array.from(ps).map((ch) => c.map.get(ch) ?? ch).join('')
    } else if (c.cmd === 'p') {
      out.push(ps)
    } else {
      deleted = true
      break
    }
  }
  if (!deleted) out.push(ps)
  return out
}

const util: Utility = {
  id: 'sed',
  name: 'sed script',
  category: 'String Ops',
  description:
    'Run a sed-style script over the text — s/pattern/replacement/flags, y/abc/xyz/, and d or p with /regex/, line-number or $ addresses — using JavaScript regex syntax, per line or over the whole input.',
  accepts: 'string',
  produces: 'string',
  tags: ['sed script', 'stream editor', 'substitute command', 'regex script', 'line editing', 'unix sed'],
  examples: [
    { title: 'global substitute per line', input: 'foo bar\nbaz foo', params: { script: 's/foo/QUX/g', perLine: true }, output: 'QUX bar\nbaz QUX' }
  ],
  params: {
    script: {
      kind: 'code',
      label: 'script (one command per line)',
      default: 's/foo/bar/g',
      placeholder: 's/foo/bar/g\n/^#/d\ny/abc/xyz/'
    },
    perLine: { kind: 'boolean', label: 'apply per line', default: true }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    if (!s) return ''
    const cmds = parseScript(String(params?.script ?? ''))
    if (!cmds.length) return s

    if (params?.perLine === false) return runCommands(cmds, s, 1, 1).join('\n')

    const trailingNewline = s.endsWith('\n')
    const lines = (trailingNewline ? s.slice(0, -1) : s).split('\n')
    const out: string[] = []
    for (let i = 0; i < lines.length; i++) {
      for (const printed of runCommands(cmds, lines[i], i + 1, lines.length)) out.push(printed)
    }
    if (!out.length) return ''
    return out.join('\n') + (trailingNewline ? '\n' : '')
  }
}

export default util
