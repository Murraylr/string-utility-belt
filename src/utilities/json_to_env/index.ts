import type { Utility } from '@/types/utility'

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array)

const pickOption = (v: unknown, options: string[], fallback: string): string =>
  typeof v === 'string' && options.includes(v) ? v : fallback

const pickBool = (v: unknown, fallback: boolean): boolean => {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

const pickString = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback)

/** Accepts either JSON text or an already-parsed value handed over by the pipeline. */
const parseJsonInput = (input: unknown): unknown => {
  if (typeof input !== 'string') return input
  const text = input.trim()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Error(`invalid JSON: ${(e as Error).message}`)
  }
}

/** Keep letters, digits and underscores; anything else would break `KEY=value` syntax. */
const sanitizeSegment = (segment: string): string => {
  const cleaned = segment.replace(/[^\p{L}\p{N}_]+/gu, '_')
  return cleaned === '' ? '_' : cleaned
}

const escapeForDoubleQuotes = (value: string): string =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t')

const needsQuotes = (value: string): boolean => {
  if (value === '') return false
  if (value !== value.trim()) return true
  return /[\s"'`$\\#]/.test(value)
}

const quoteValue = (value: string, mode: string): string => {
  if (mode === 'never') {
    // no quoting available, so keep the record on one line
    return value.replace(/\r\n|\r|\n/g, '\\n')
  }
  if (mode === 'auto' && !needsQuotes(value)) return value
  // Single quotes are literal in .env, which keeps `$VAR` and backslashes intact.
  if (!/[\r\n]/.test(value) && /[$\\]/.test(value) && !value.includes("'")) {
    return `'${value}'`
  }
  return `"${escapeForDoubleQuotes(value)}"`
}

const scalarToString = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return String(v)
}

const util: Utility = {
  id: 'json_to_env',
  name: 'json to .env',
  category: 'Data Formats',
  description:
    'Flatten JSON into .env style KEY=value lines, with an upper-case option, a configurable path delimiter, auto, always or never quoting and an optional export prefix.',
  accepts: 'string',
  produces: 'string',
  tags: ['dotenv', 'env file', 'json', 'flatten', 'config', 'environment variables'],
  aliases: ['dotenv'],
  examples: [
    {
      title: 'flat and nested keys',
      input: '{"port":3000,"debug":true,"db":{"host":"localhost"}}',
      output: 'PORT=3000\nDEBUG=true\nDB_HOST=localhost'
    },
    {
      title: 'always quote values',
      input: '{"greeting":"hi there"}',
      params: { quote: 'always' },
      output: 'GREETING="hi there"'
    }
  ],
  params: {
    upperCase: { kind: 'boolean', label: 'upper-case keys', default: true },
    delimiter: { kind: 'string', label: 'path delimiter', default: '_' },
    quote: { kind: 'select', label: 'quoting', options: ['auto', 'always', 'never'], default: 'auto' },
    exportPrefix: { kind: 'boolean', label: 'export prefix', default: false }
  },
  apply: (input: any, params: any) => {
    const upperCase = pickBool(params?.upperCase, true)
    const delimiter = pickString(params?.delimiter, '_')
    const quote = pickOption(params?.quote, ['auto', 'always', 'never'], 'auto')
    const exportPrefix = pickBool(params?.exportPrefix, false)

    const data = parseJsonInput(input)
    if (data === undefined) return ''
    if (!isPlainObject(data)) {
      throw new Error('json to .env expects a JSON object at the root')
    }

    const lines: string[] = []

    const emit = (segments: string[], value: string) => {
      const key = segments.map(sanitizeSegment).join(delimiter)
      const name = upperCase ? key.toUpperCase() : key
      lines.push(`${exportPrefix ? 'export ' : ''}${name}=${quoteValue(value, quote)}`)
    }

    const walk = (value: unknown, segments: string[]): void => {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          emit(segments, '')
          return
        }
        value.forEach((item, i) => walk(item, [...segments, String(i)]))
        return
      }
      if (isPlainObject(value)) {
        const keys = Object.keys(value)
        if (keys.length === 0) {
          if (segments.length > 0) emit(segments, '')
          return
        }
        for (const key of keys) walk(value[key], [...segments, key])
        return
      }
      emit(segments, scalarToString(value))
    }

    walk(data, [])

    return lines.join('\n')
  }
}

export default util
