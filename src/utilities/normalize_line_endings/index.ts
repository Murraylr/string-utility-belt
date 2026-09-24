import type { Utility } from '@/types/utility'

type Mode = 'lf' | 'crlf' | 'cr' | 'detect'
type FinalNewline = 'keep' | 'add' | 'remove'

const EOL: Record<Exclude<Mode, 'detect'>, string> = {
  lf: '\n',
  crlf: '\r\n',
  cr: '\r'
}

/** Count each flavour in one pass so a CRLF is never double counted as CR + LF. */
function countEndings(s: string) {
  let crlf = 0
  let lf = 0
  let cr = 0
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    if (c === 13) {
      if (s.charCodeAt(i + 1) === 10) {
        crlf++
        i++
      } else {
        cr++
      }
    } else if (c === 10) {
      lf++
    }
  }
  return { crlf, lf, cr }
}

function selectParam<T extends string>(v: unknown, name: string, options: readonly T[], dflt: T): T {
  if (v === undefined || v === null || v === '') return dflt
  const s = String(v)
  if (!(options as readonly string[]).includes(s)) {
    throw new Error(`${name} must be one of ${options.join(', ')} (got "${s}")`)
  }
  return s as T
}

const util: Utility = {
  id: 'normalize_line_endings',
  name: 'normalize line endings',
  category: 'Formatting',
  description:
    'Convert line endings to LF, CRLF, or CR — or detect which the text uses — and keep, add, or remove the final newline.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['crlf', 'lf', 'eol', 'line ending', 'dos2unix', 'unix2dos'],
  aliases: ['dos2unix', 'unix2dos'],
  examples: [
    { title: 'convert to CRLF', input: 'a\nb\nc', params: { mode: 'crlf' }, output: 'a\r\nb\r\nc' },
    {
      title: 'detect the mix',
      input: 'a\r\nb\nc',
      params: { mode: 'detect' },
      output: '{\n  "crlf": 1,\n  "lf": 1,\n  "cr": 0,\n  "mixed": true,\n  "dominant": "crlf"\n}'
    }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['lf', 'crlf', 'cr', 'detect'],
      default: 'lf'
    },
    finalNewline: {
      kind: 'select',
      label: 'final newline',
      options: ['keep', 'add', 'remove'],
      default: 'keep'
    }
  },
  apply: (input: any, params: any) => {
    const p = params ?? {}
    const mode = selectParam<Mode>(p.mode, 'mode', ['lf', 'crlf', 'cr', 'detect'] as const, 'lf')
    const finalNewline = selectParam<FinalNewline>(
      p.finalNewline,
      'finalNewline',
      ['keep', 'add', 'remove'] as const,
      'keep'
    )

    const s = String(input)

    if (mode === 'detect') {
      const { crlf, lf, cr } = countEndings(s)
      // ties resolve in crlf > lf > cr order; `none` when the text has no line breaks
      const kinds: Array<[string, number]> = [
        ['crlf', crlf],
        ['lf', lf],
        ['cr', cr]
      ]
      const present = kinds.filter(([, n]) => n > 0)
      let dominant = 'none'
      let best = 0
      for (const [name, n] of kinds) {
        if (n > best) {
          best = n
          dominant = name
        }
      }
      return { crlf, lf, cr, mixed: present.length > 1, dominant }
    }

    if (s === '') return ''

    const eol = EOL[mode]
    // split on every flavour, then re-join with the target: `keep` falls out for
    // free because a trailing terminator yields a trailing empty segment
    let out = s.split(/\r\n|\n|\r/).join(eol)

    if (finalNewline === 'add') {
      if (!out.endsWith(eol)) out += eol
    } else if (finalNewline === 'remove') {
      out = out.replace(/(?<![\r\n])(?:\r\n|\n|\r)+$/, '')
    }

    return out
  }
}

export default util
