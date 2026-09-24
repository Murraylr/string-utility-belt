import type { Utility } from '@/types/utility'

/**
 * Escape text for use inside a SQL string literal.
 *
 *  - ansi / postgres  double the single quote (`''`). Backslashes stay literal,
 *                     which is what PostgreSQL does with the default
 *                     standard_conforming_strings = on.
 *  - mysql            mysql_real_escape_string() semantics: backslash escapes
 *                     for NUL, LF, CR, backslash, both quote characters and
 *                     Ctrl-Z.
 *  - mssql            double the single quote, and prefix the literal with `N`
 *                     when it contains non-ASCII text so T-SQL treats it as
 *                     nvarchar rather than silently mangling it to the code page.
 */

const NUL = String.fromCharCode(0)
const SUB = String.fromCharCode(26)

const MYSQL_ESCAPES = new Map<string, string>([
  ['\\', '\\\\'],
  ["'", "\\'"],
  ['"', '\\"'],
  ['\n', '\\n'],
  ['\r', '\\r'],
  [NUL, '\\0'],
  [SUB, '\\Z']
])

const escapeMysql = (s: string) => {
  let out = ''
  // Iterate code points so astral characters are never split apart.
  for (const ch of Array.from(s)) {
    const replacement = MYSQL_ESCAPES.get(ch)
    out += replacement === undefined ? ch : replacement
  }
  return out
}

const hasNonAscii = (s: string) => Array.from(s).some(ch => (ch.codePointAt(0) as number) > 0x7f)

const util: Utility = {
  id: 'sql_escape',
  name: 'sql escape',
  category: 'String Ops',
  description:
    "Escape text for a SQL string literal using ANSI/PostgreSQL quote doubling, MySQL backslash escapes, or T-SQL with an N'' Unicode prefix.",
  accepts: 'string',
  produces: 'string',
  tags: ['sql injection', 'escape quotes', 'sql string literal', 'mysql escape', 'postgres escape', 'sanitize sql'],
  examples: [
    { title: 'ansi quote doubling', input: "O'Brien", params: { flavor: 'ansi', wrap: true }, output: "'O''Brien'" },
    { title: 'mysql backslash escapes', input: "O'Brien", params: { flavor: 'mysql', wrap: true }, output: "'O\\'Brien'" }
  ],
  params: {
    flavor: {
      kind: 'select',
      label: 'flavor',
      options: ['ansi', 'mysql', 'postgres', 'mssql'],
      default: 'ansi'
    },
    wrap: {
      kind: 'boolean',
      label: 'wrap in quotes',
      default: true
    }
  },
  apply: (input: any, { flavor = 'ansi', wrap = true }: any) => {
    const s = String(input ?? '')
    if (s === '') return ''

    if (flavor === 'mysql') {
      const body = escapeMysql(s)
      return wrap ? `'${body}'` : body
    }

    if (s.indexOf(NUL) !== -1) {
      throw new Error(
        `${flavor} string literals cannot contain NUL (U+0000) — remove it, or use the mysql flavor which escapes it as \\0`
      )
    }

    const body = s.split("'").join("''")
    if (!wrap) return body
    if (flavor === 'mssql' && hasNonAscii(s)) return `N'${body}'`
    return `'${body}'`
  }
}

export default util
