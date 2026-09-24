import type { Utility } from '@/types/utility'

/** Resolve the requested amount against the available amount, supporting `head -n -K`. */
function resolveCount(k: number, total: number): number {
  return k >= 0 ? Math.min(k, total) : Math.max(0, total + k)
}

/**
 * Split into lines while remembering the exact terminator that followed each one, so a file
 * with mixed endings is not silently rewritten to a single style. `eols[i]` is `''` only for a
 * final line that the input left unterminated; `trailing` says whether the input ended with a
 * newline at all.
 */
function splitLines(s: string): { lines: string[]; eols: string[]; trailing: boolean } {
  const lines: string[] = []
  const eols: string[] = []
  const re = /\r\n|\n/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) {
    lines.push(s.slice(last, m.index))
    eols.push(m[0])
    last = re.lastIndex
  }
  if (last < s.length) {
    lines.push(s.slice(last))
    eols.push('')
    return { lines, eols, trailing: false }
  }
  return { lines, eols, trailing: lines.length > 0 }
}

const util: Utility = {
  id: 'head',
  name: 'head',
  category: 'Lines',
  description:
    'Keep the first N lines, words, or characters — a negative count keeps everything but the last N.',
  accepts: 'string',
  produces: 'string',
  params: {
    count: { kind: 'number', label: 'count (negative = all but the last N)', default: 10, integer: true },
    unit: { kind: 'select', label: 'unit', options: ['lines', 'characters', 'words'], default: 'lines' }
  },
  tags: ['head', 'first lines', 'top lines', 'truncate', 'preview'],
  aliases: ['head -n'],
  examples: [
    { title: 'first 2 lines', input: 'one\ntwo\nthree\nfour\nfive', params: { count: 2, unit: 'lines' }, output: 'one\ntwo' },
    { title: 'first 5 characters', input: 'hello world', params: { count: 5, unit: 'characters' }, output: 'hello' }
  ],
  apply: (input: any, params: any) => {
    const { count = 10, unit = 'lines' } = params ?? {}

    const s = String(input)
    if (s === '') return ''

    const n = Number(count)
    if (!Number.isFinite(n)) throw new Error('count must be a finite number')
    const k = Math.trunc(n)

    if (unit === 'characters') {
      // code points, so an emoji is never cut in half
      const cps = Array.from(s)
      return cps.slice(0, resolveCount(k, cps.length)).join('')
    }

    if (unit === 'words') {
      const words = [...s.matchAll(/\S+/g)]
      const want = resolveCount(k, words.length)
      if (want === 0) return ''
      // asking for every word is a no-op, trailing whitespace and all
      if (want === words.length) return s
      const last = words[want - 1]
      // slice rather than re-join, so the original spacing between words survives
      return s.slice(0, (last.index ?? 0) + last[0].length)
    }

    if (unit !== 'lines') throw new Error(`unknown unit: ${String(unit)}`)

    const { lines, eols, trailing } = splitLines(s)

    const want = resolveCount(k, lines.length)
    if (want === 0) return ''
    // each line keeps the terminator it arrived with, so mixed endings survive untouched
    let text = ''
    for (let i = 0; i < want; i++) text += lines[i] + eols[i]
    // the output ends with a newline only if the input did
    return trailing ? text : text.replace(/\r\n$|\n$/, '')
  }
}

export default util
