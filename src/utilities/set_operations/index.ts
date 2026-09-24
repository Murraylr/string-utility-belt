import type { Utility } from '@/types/utility'

const OPERATIONS = ['union', 'intersection', 'difference', 'symmetric-difference'] as const
type Operation = (typeof OPERATIONS)[number]

const asBool = (value: unknown, fallback: boolean) =>
  value === undefined || value === null || value === '' ? fallback : !!value

/**
 * Split a block of text into set members. Blank members are dropped so that a
 * trailing newline (or a stray empty line between entries) never becomes a
 * phantom member of the set.
 */
const toLines = (text: string, trim: boolean): string[] => {
  if (text === '') return []
  const out: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = trim ? raw.trim() : raw
    if (line !== '') out.push(line)
  }
  return out
}

const keyOf = (line: string, ignoreCase: boolean) => (ignoreCase ? line.toLowerCase() : line)

/** Keep the first occurrence of each key, preserving order. */
const dedupe = (lines: string[], ignoreCase: boolean): string[] => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const line of lines) {
    const key = keyOf(line, ignoreCase)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(line)
  }
  return out
}

const util: Utility = {
  id: 'set_operations',
  name: 'line set operations',
  category: 'Lines',
  description:
    "Compare the input's lines with a second list using union, intersection, difference, or symmetric difference.",
  accepts: 'string',
  produces: 'string',
  params: {
    other: { kind: 'file', as: 'text', label: 'other list (one per line)', default: '', placeholder: 'one item per line' },
    operation: {
      kind: 'select',
      label: 'operation',
      options: ['union', 'intersection', 'difference', 'symmetric-difference'],
      default: 'intersection'
    },
    ignoreCase: { kind: 'boolean', label: 'ignore case', default: false },
    trim: { kind: 'boolean', label: 'trim lines', default: true },
    sort: { kind: 'boolean', label: 'sort result', default: false }
  },
  tags: ['set operations', 'union', 'intersection', 'difference', 'compare lists', 'venn diagram', 'diff lines'],
  aliases: ['comm'],
  examples: [
    { title: 'intersection', input: 'a\nb\nc', params: { other: 'b\nc\nd', operation: 'intersection' }, output: 'b\nc' },
    { title: 'sorted union', input: 'a\nb\nc', params: { other: 'b\nc\nd', operation: 'union', sort: true }, output: 'a\nb\nc\nd' }
  ],
  apply: (input: any, params: any) => {
    const rawOperation = String(params?.operation ?? '') || 'intersection'
    if (!(OPERATIONS as readonly string[]).includes(rawOperation)) {
      throw new Error(`unknown operation: ${rawOperation} (expected ${OPERATIONS.join(', ')})`)
    }
    const operation = rawOperation as Operation
    const ignoreCase = asBool(params?.ignoreCase, false)
    const trim = asBool(params?.trim, true)
    const sort = asBool(params?.sort, false)

    const left = toLines(String(input ?? ''), trim)
    const right = toLines(String(params?.other ?? ''), trim)
    const leftKeys = new Set(left.map(line => keyOf(line, ignoreCase)))
    const rightKeys = new Set(right.map(line => keyOf(line, ignoreCase)))

    const onlyLeft = left.filter(line => !rightKeys.has(keyOf(line, ignoreCase)))
    const onlyRight = right.filter(line => !leftKeys.has(keyOf(line, ignoreCase)))

    let result: string[]
    switch (operation) {
      case 'union':
        result = dedupe([...left, ...right], ignoreCase)
        break
      case 'intersection':
        result = dedupe(left.filter(line => rightKeys.has(keyOf(line, ignoreCase))), ignoreCase)
        break
      case 'difference':
        result = dedupe(onlyLeft, ignoreCase)
        break
      case 'symmetric-difference':
        result = dedupe([...onlyLeft, ...onlyRight], ignoreCase)
        break
      default:
        throw new Error(`unknown operation: ${rawOperation}`)
    }

    if (sort) {
      result = [...result].sort((a, b) => {
        const ka = keyOf(a, ignoreCase)
        const kb = keyOf(b, ignoreCase)
        return ka < kb ? -1 : ka > kb ? 1 : 0
      })
    }
    return result.join('\n')
  }
}

export default util
