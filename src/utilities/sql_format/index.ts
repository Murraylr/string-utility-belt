import type { Utility } from '@/types/utility'

/**
 * `sql-formatter` is a sizable dependency and `src/utilities/index.ts` eagerly
 * globs every utility module, so it must never be a top-level import. Load it
 * lazily on first use and cache the module — the pipeline re-runs on every
 * keystroke, so re-importing per call would be wasteful.
 */
let _sqlFormatter: typeof import('sql-formatter') | null = null
const getSqlFormatter = async () => (_sqlFormatter ??= await import('sql-formatter'))

export const DIALECTS = [
  'sql',
  'mysql',
  'postgresql',
  'sqlite',
  'mariadb',
  'bigquery',
  'spark',
  'transactsql'
] as const
type Dialect = (typeof DIALECTS)[number]

export const KEYWORD_CASES = ['upper', 'lower', 'preserve'] as const
type KeywordCase = (typeof KEYWORD_CASES)[number]

const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback

/** Coerce a param to a whole number inside [min, max]; non-numeric falls back. */
const clampInt = (value: unknown, fallback: number, min: number, max: number): number => {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.trunc(n)))
}

/** sql-formatter errors are multi-line and chatty; keep the first, useful line. */
const firstLine = (err: unknown): string => {
  const message = err instanceof Error ? err.message : String(err)
  return message.split('\n')[0].trim() || 'unknown parse error'
}

const util: Utility = {
  id: 'sql_format',
  name: 'sql format',
  category: 'Formatting',
  description:
    'Pretty-print a SQL query with a chosen dialect, keyword case, indent width, and blank lines between statements.',
  accepts: 'string',
  produces: 'string',
  tags: ['sql pretty print', 'sql beautify', 'query formatter', 'sql-formatter'],
  examples: [
    {
      title: 'default dialect, upper keywords',
      input: 'select a,b from t where a=1',
      output: 'SELECT\n  a,\n  b\nFROM\n  t\nWHERE\n  a = 1'
    }
  ],
  params: {
    dialect: {
      kind: 'select',
      label: 'dialect',
      options: [...DIALECTS],
      default: 'sql'
    },
    keywordCase: {
      kind: 'select',
      label: 'keyword case',
      options: [...KEYWORD_CASES],
      default: 'upper'
    },
    indent: { kind: 'number', label: 'indent width', default: 2, min: 0, max: 16, integer: true },
    linesBetweenQueries: { kind: 'number', label: 'blank lines between queries', default: 1, min: 0, max: 10, integer: true }
  },
  apply: async (input: any, params: any) => {
    const source = String(input ?? '')
    // Whitespace-only input has nothing to format — never throw on it.
    if (source.trim() === '') return ''

    const dialect: Dialect = pick(params?.dialect, DIALECTS, 'sql')
    const keywordCase: KeywordCase = pick(params?.keywordCase, KEYWORD_CASES, 'upper')
    // tabWidth < 0 makes sql-formatter throw a RangeError from String.repeat.
    const tabWidth = clampInt(params?.indent, 2, 0, 16)
    const linesBetweenQueries = clampInt(params?.linesBetweenQueries, 1, 0, 10)

    const { format } = await getSqlFormatter()
    try {
      return format(source, { language: dialect, keywordCase, tabWidth, linesBetweenQueries })
    } catch (err) {
      throw new Error(`could not format SQL (${dialect}): ${firstLine(err)}`)
    }
  }
}

export default util
