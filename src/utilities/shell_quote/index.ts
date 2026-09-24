import type { Utility } from '@/types/utility'

/**
 * Quote or escape a string so a shell passes it through literally. Quote mode
 * always yields a single argument; escape mode only neutralises the characters
 * the shell would otherwise interpret. Three flavors:
 *
 *  - posix       sh/bash/zsh. quote  => single quotes with the `'\''` dance.
 *                             escape => backslash every unsafe byte (Bourne
 *                                       shells cannot backslash-escape a real
 *                                       newline, so newlines become '<LF>').
 *  - powershell  quote  => single quotes, internal `'` doubled (literal string).
 *                escape => backtick escapes, `n / `r / `t for line breaks.
 *                          PowerShell cannot escape a *leading* space outside
 *                          quotes, so that case is rejected.
 *  - cmd         quote  => double quotes using the CommandLineToArgvW rules
 *                          (backslash runs before a `"` are doubled).
 *                escape => `^` before every cmd.exe metacharacter. Whitespace is
 *                          deliberately NOT carets-escaped: `^` only hides a
 *                          character from cmd.exe's own parser and does nothing
 *                          about argument splitting, so use quote mode when the
 *                          text has to arrive as a single argument.
 */

// Characters that never need quoting or escaping for a POSIX shell.
const POSIX_SAFE = /^[A-Za-z0-9_@%+=:,./-]$/
// Characters that are literal when unquoted in PowerShell (backslash included:
// it is not an escape character there and is very common in Windows paths).
// `,` is NOT safe: unquoted it is the array operator, so `a,b` binds as two
// arguments instead of one string.
const POWERSHELL_SAFE = /^[A-Za-z0-9_+=:./\\-]$/
// The cmd.exe metacharacters a caret can actually neutralise. `"` is handled
// separately (it also has to survive CommandLineToArgvW) and whitespace is
// absent on purpose — see the note above.
const CMD_META = new Set(['(', ')', '%', '!', '^', '<', '>', '&', '|', ',', ';', '='])

const NUL = String.fromCharCode(0)
const NUL_ERROR = 'shell arguments cannot contain NUL (U+0000)'
const CMD_EOL_ERROR = 'cmd.exe cannot represent line breaks inside an argument'
const PS_LEADING_SPACE_ERROR =
  'powershell cannot escape a leading space outside quotes — use quote mode'

const assertNoNul = (s: string) => {
  if (s.indexOf(NUL) !== -1) throw new Error(NUL_ERROR)
}

const assertCmdSafe = (s: string) => {
  assertNoNul(s)
  if (s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) throw new Error(CMD_EOL_ERROR)
}

const posixQuote = (s: string) => {
  assertNoNul(s)
  return `'${s.split("'").join("'\\''")}'`
}

const posixEscape = (s: string) => {
  assertNoNul(s)
  let out = ''
  for (const ch of Array.from(s)) {
    // A backslash before a newline is a line continuation, so quote it instead.
    if (ch === '\n') { out += "'\n'"; continue }
    const cp = ch.codePointAt(0) as number
    // Non-ASCII needs no escaping and must not be split into surrogate halves.
    if (cp > 0x7f || POSIX_SAFE.test(ch)) { out += ch; continue }
    out += `\\${ch}`
  }
  return out
}

const powershellQuote = (s: string) => {
  assertNoNul(s)
  return `'${s.split("'").join("''")}'`
}

const powershellEscape = (s: string) => {
  assertNoNul(s)
  // PowerShell eats a backtick-escaped space while it is still skipping the
  // whitespace before the argument, so a leading space simply disappears.
  if (s.startsWith(' ')) throw new Error(PS_LEADING_SPACE_ERROR)
  let out = ''
  const chars = Array.from(s)
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === '\n') { out += '`n'; continue }
    if (ch === '\r') { out += '`r'; continue }
    if (ch === '\t') { out += '`t'; continue }
    // A leading `-` would bind as a parameter name rather than a value.
    if (i === 0 && ch === '-') { out += '`-'; continue }
    const cp = ch.codePointAt(0) as number
    if (cp > 0x7f || POWERSHELL_SAFE.test(ch)) { out += ch; continue }
    out += `\`${ch}`
  }
  return out
}

const cmdQuote = (s: string) => {
  assertCmdSafe(s)
  let out = '"'
  let backslashes = 0
  for (const ch of Array.from(s)) {
    if (ch === '\\') { backslashes++; continue }
    if (ch === '"') {
      out += '\\'.repeat(backslashes * 2 + 1) + '"'
      backslashes = 0
      continue
    }
    out += '\\'.repeat(backslashes) + ch
    backslashes = 0
  }
  return `${out}${'\\'.repeat(backslashes * 2)}"`
}

const cmdEscape = (s: string) => {
  assertCmdSafe(s)
  let out = ''
  let backslashes = 0
  for (const ch of Array.from(s)) {
    if (ch === '\\') { backslashes++; continue }
    if (ch === '"') {
      // A bare `^"` only hides the quote from cmd.exe — CommandLineToArgvW then
      // eats it. `\^"` survives both layers, with the preceding backslash run
      // doubled the same way cmdQuote doubles it.
      out += '\\'.repeat(backslashes * 2) + '\\^"'
      backslashes = 0
      continue
    }
    out += '\\'.repeat(backslashes) + (CMD_META.has(ch) ? `^${ch}` : ch)
    backslashes = 0
  }
  // Trailing backslashes are only special in front of a quote, so leave them.
  return out + '\\'.repeat(backslashes)
}

const util: Utility = {
  id: 'shell_quote',
  name: 'shell quote',
  category: 'String Ops',
  description:
    'Quote or backslash-escape text so it survives a shell as one argument, for POSIX sh, PowerShell, or cmd.exe.',
  accepts: 'string',
  produces: 'string',
  tags: ['shell escaping', 'quote argument', 'bash quote', 'powershell quote', 'cmd quote', 'command line argument'],
  examples: [
    { title: 'posix single-quote', input: "it's a test", params: { flavor: 'posix', mode: 'quote' }, output: "'it'\\''s a test'" },
    { title: 'powershell single-quote', input: 'hello world', params: { flavor: 'powershell', mode: 'quote' }, output: "'hello world'" }
  ],
  params: {
    flavor: {
      kind: 'select',
      label: 'flavor',
      options: ['posix', 'powershell', 'cmd'],
      default: 'posix'
    },
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['quote', 'escape'],
      default: 'quote'
    }
  },
  apply: (input: any, { flavor = 'posix', mode = 'quote' }: any) => {
    const s = String(input ?? '')
    if (s === '') return ''
    const quoting = mode !== 'escape'
    switch (flavor) {
      case 'powershell':
        return quoting ? powershellQuote(s) : powershellEscape(s)
      case 'cmd':
        return quoting ? cmdQuote(s) : cmdEscape(s)
      case 'posix':
      default:
        return quoting ? posixQuote(s) : posixEscape(s)
    }
  }
}

export default util
