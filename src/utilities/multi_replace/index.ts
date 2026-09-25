import type { Utility } from '@/types/utility'

export type Rule = { find: string; replace: string; line: number }

/** Resolve the backslash escapes a rule line may contain. */
function unescape(s: string): string {
  let out = ''
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c !== '\\' || i + 1 >= s.length) {
      out += c
      continue
    }
    const n = s[i + 1]
    if (n === 'n') { out += '\n'; i++; continue }
    if (n === 't') { out += '\t'; i++; continue }
    if (n === 'r') { out += '\r'; i++; continue }
    if (n === 'f') { out += '\f'; i++; continue }
    if (n === 'v') { out += '\v'; i++; continue }
    if (n === '0') { out += '\u0000'; i++; continue }
    if (n === '\\') { out += '\\'; i++; continue }
    // `#` opens a comment, so `\#` is the only way to write a rule for one.
    if (n === '#') { out += '#'; i++; continue }
    if (n === 'x') {
      const m = /^[0-9a-fA-F]{2}/.exec(s.slice(i + 2))
      if (m) { out += String.fromCharCode(parseInt(m[0], 16)); i += 1 + m[0].length; continue }
    }
    if (n === 'u') {
      const m = /^(?:\{[0-9a-fA-F]{1,6}\}|[0-9a-fA-F]{4})/.exec(s.slice(i + 2))
      if (m) {
        const cp = parseInt(m[0].replace(/[{}]/g, ''), 16)
        if (cp <= 0x10ffff) { out += String.fromCodePoint(cp); i += 1 + m[0].length; continue }
      }
    }
    out += c
  }
  return out
}

/** Parse the rule list: `find => replace`, `find<TAB>replace`, or `find`
 *  alone (delete). `#` comments and blank lines are skipped. */
export function parseRules(text: string, regex: boolean): Rule[] {
  const rules: Rule[] = []
  const lines = String(text ?? '').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/\r$/, '')
    const probe = raw.trim()
    if (!probe || probe.startsWith('#')) continue

    const arrow = raw.indexOf('=>')
    const tab = raw.indexOf('\t')
    let find: string
    let replace: string
    if (arrow >= 0 && (tab < 0 || arrow < tab)) {
      // trim(), not /^\s+|\s+$/g: same result, and that regex is quadratic on a long inner space run
      find = raw.slice(0, arrow).trim()
      replace = raw.slice(arrow + 2).trim()
    } else if (tab >= 0) {
      // Tab form keeps surrounding spaces intact.
      find = raw.slice(0, tab)
      replace = raw.slice(tab + 1)
    } else {
      find = probe
      replace = ''
    }

    // A regex pattern is handed to the engine verbatim so its own escapes
    // (\d, \s, \b ...) survive; literals get the escapes resolved here.
    if (!regex) find = unescape(find)
    replace = unescape(replace)

    if (!find) throw new Error(`multi_replace: rule on line ${i + 1} has an empty find pattern`)
    rules.push({ find, replace, line: i + 1 })
  }
  return rules
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Compile a rule pattern, preferring unicode mode but falling back for
 *  patterns that are only valid without the `u` flag. */
function compile(source: string, flags: string, rule: Rule): RegExp {
  try {
    return new RegExp(source, flags + 'u')
  } catch {
    try {
      return new RegExp(source, flags)
    } catch (err) {
      throw new Error(`multi_replace: invalid regex on line ${rule.line}: ${(err as Error).message}`)
    }
  }
}

/** Expand `$&`, `$1`…`$99` and `$$` against a sticky match. */
function expand(template: string, m: RegExpExecArray): string {
  let out = ''
  for (let i = 0; i < template.length; i++) {
    const c = template[i]
    if (c !== '$' || i + 1 >= template.length) { out += c; continue }
    const n = template[i + 1]
    if (n === '$') { out += '$'; i++; continue }
    if (n === '&') { out += m[0]; i++; continue }
    const digits = /^\d{1,2}/.exec(template.slice(i + 1))
    if (digits) {
      let take = digits[0]
      if (take.length === 2 && m[Number(take)] === undefined) take = take[0]
      const idx = Number(take)
      if (idx > 0 && idx < m.length) {
        out += m[idx] ?? ''
        i += take.length
        continue
      }
    }
    out += c
  }
  return out
}

/** Global replace driven by an explicit exec loop so that `expand` sees the
 *  real match array (no ambiguity from named-group replacer arguments). */
function replaceAllWith(text: string, re: RegExp, template: string): string {
  let out = ''
  let last = 0
  let m: RegExpExecArray | null
  re.lastIndex = 0
  while ((m = re.exec(text)) !== null) {
    out += text.slice(last, m.index) + expand(template, m)
    last = m.index + m[0].length
    if (m[0].length === 0) {
      const cp = text.codePointAt(re.lastIndex)
      re.lastIndex += cp === undefined ? 1 : String.fromCodePoint(cp).length
    }
  }
  return out + text.slice(last)
}

/** One left-to-right pass: at each position the first matching rule wins and
 *  its output is never re-scanned. */
function singlePass(s: string, rules: Rule[], regex: boolean, ignoreCase: boolean): string {
  const compiled = rules.map((r) => ({
    rule: r,
    re: regex ? compile(r.find, ignoreCase ? 'yi' : 'y', r) : null,
    needle: ignoreCase ? r.find.toLowerCase() : r.find
  }))
  const out: string[] = []
  let i = 0
  while (i < s.length) {
    let text: string | null = null
    let len = 0
    for (const c of compiled) {
      if (c.re) {
        c.re.lastIndex = i
        const m = c.re.exec(s)
        if (m) {
          text = expand(c.rule.replace, m)
          len = m[0].length
          break
        }
      } else {
        const slice = s.slice(i, i + c.rule.find.length)
        if ((ignoreCase ? slice.toLowerCase() : slice) === c.needle) {
          text = c.rule.replace
          len = c.rule.find.length
          break
        }
      }
    }
    if (text !== null && len > 0) {
      out.push(text)
      i += len
      continue
    }
    if (text !== null) out.push(text) // zero-length match: emit, then advance
    const cp = s.codePointAt(i)
    const ch = cp === undefined ? s[i] : String.fromCodePoint(cp)
    out.push(ch)
    i += ch.length
  }
  return out.join('')
}

/** Build rules from the `keyvalue` editor shape, skipping blank find fields
 *  (a fresh row in the editor) instead of throwing. */
function rulesFromPairs(pairs: unknown): Rule[] {
  const arr = Array.isArray(pairs) ? pairs : []
  const rules: Rule[] = []
  arr.forEach((pair, i) => {
    if (!Array.isArray(pair)) return
    const find = String(pair[0] ?? '')
    if (!find) return
    rules.push({ find, replace: String(pair[1] ?? ''), line: i + 1 })
  })
  return rules
}

const util: Utility = {
  id: 'multi_replace',
  name: 'multi replace',
  category: 'String Ops',
  description:
    'Apply a list of find/replace pairs at once, optionally as regexes, case-insensitively, or in a single non-cascading pass.',
  accepts: 'string',
  produces: 'string',
  tags: ['find and replace', 'bulk replace', 'rules', 'mapping table', 'multiple replacements', 'substitution list'],
  examples: [
    {
      title: 'find and replace pairs, applied in order',
      input: 'the colour grey',
      params: { rules: [['colour', 'color'], ['grey', 'gray']] },
      output: 'the color gray'
    }
  ],
  params: {
    rules: {
      kind: 'keyvalue',
      label: 'rules (find / replace)',
      default: [],
      keyLabel: 'find',
      valueLabel: 'replace'
    },
    regex: { kind: 'boolean', label: 'find is a regex', default: false },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: false },
    applyOnce: { kind: 'boolean', label: 'apply once (rules do not cascade)', default: false }
  },
  apply: (input: any, params: any) => {
    const s = String(input ?? '')
    if (!s) return '' // empty input never throws, even for a malformed rule list
    const regex = params?.regex === true
    const ignoreCase = params?.ignoreCase === true
    // Accept both the new keyvalue-pairs shape and the legacy multi-line string,
    // so pipelines saved before this upgrade keep working unchanged.
    const rawRules = params?.rules
    const rules = Array.isArray(rawRules) ? rulesFromPairs(rawRules) : parseRules(String(rawRules ?? ''), regex)
    if (!rules.length) return s

    if (params?.applyOnce === true) return singlePass(s, rules, regex, ignoreCase)

    let out = s
    for (const r of rules) {
      if (regex) {
        out = replaceAllWith(out, compile(r.find, ignoreCase ? 'gi' : 'g', r), r.replace)
      } else if (ignoreCase) {
        const re = compile(escapeRe(r.find), 'gi', r)
        out = out.replace(re, () => r.replace)
      } else {
        out = out.split(r.find).join(r.replace)
      }
    }
    return out
  }
}

export default util
