import type { Utility } from '@/types/utility'

function boolParam(v: unknown, name: string, dflt: boolean): boolean {
  if (v === undefined || v === null || v === '') return dflt
  if (typeof v === 'boolean') return v
  if (v === 'true') return true
  if (v === 'false') return false
  throw new Error(`${name} must be true or false (got "${String(v)}")`)
}

const util: Utility = {
  id: 'collapse_whitespace',
  name: 'collapse whitespace',
  category: 'String Ops',
  description:
    'Squeeze runs of spaces to one, limit blank lines to one, trim line ends, and optionally turn tabs and Unicode spaces such as NBSP into ordinary spaces.',
  accepts: 'string',
  produces: 'string',
  params: {
    spaces: { kind: 'boolean', label: 'collapse runs of spaces to one', default: true },
    newlines: { kind: 'boolean', label: 'collapse 3+ newlines to 2 (one blank line)', default: true },
    trim: { kind: 'boolean', label: 'trim each line and the whole text', default: true },
    tabsToSpaces: { kind: 'boolean', label: 'tabs to spaces', default: false },
    unicodeSpaces: { kind: 'boolean', label: 'unicode spaces (NBSP etc.) to normal spaces', default: true }
  },
  tags: ['squeeze whitespace', 'normalize spaces', 'remove extra spaces', 'trim blank lines', 'whitespace cleanup'],
  examples: [
    { title: 'collapse spaces and blank lines', input: 'hello    world  \n\n\n\nfoo', output: 'hello world\n\nfoo' }
  ],
  apply: (input: any, params: any) => {
    const p = params ?? {}
    const spaces = boolParam(p.spaces, 'spaces', true)
    const newlines = boolParam(p.newlines, 'newlines', true)
    const trim = boolParam(p.trim, 'trim', true)
    const tabsToSpaces = boolParam(p.tabsToSpaces, 'tabsToSpaces', false)
    const unicodeSpaces = boolParam(p.unicodeSpaces, 'unicodeSpaces', true)

    let s = String(input)
    if (s === '') return ''

    // \p{Zs} is every space separator — NBSP, en/em quad, ideographic space, …
    if (unicodeSpaces) s = s.replace(/\p{Zs}/gu, ' ')
    // Tabs are only touched when `tabsToSpaces` asks for it — collapsing them here
    // as well would make that switch a no-op and would quietly destroy tab-delimited
    // data (a\t\tb loses an empty field) whenever `spaces` is on, which is the default.
    if (tabsToSpaces) s = s.replace(/\t/g, ' ')
    if (spaces) s = s.replace(/ {2,}/g, ' ')

    if (trim) {
      // trim per line without disturbing the line terminators themselves
      const parts = s.split(/(\r\n|\n|\r)/)
      for (let i = 0; i < parts.length; i += 2) parts[i] = parts[i].trim()
      s = parts.join('')
    }

    if (newlines) {
      // three or more terminators (blank lines may still hold spaces) become two
      s = s.replace(/(?:\r\n|\n|\r)(?:[ \t]*(?:\r\n|\n|\r)){2,}/g, (m) => {
        const eol = m.startsWith('\r\n') ? '\r\n' : m[0] === '\r' ? '\r' : '\n'
        return eol + eol
      })
    }

    if (trim) s = s.trim()

    return s
  }
}

export default util
