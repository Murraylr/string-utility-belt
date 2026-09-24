import type { Utility } from '@/types/utility'

type Pair = { key: string; value: string; preEncoded?: boolean }

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !(v instanceof Uint8Array)

const isScalar = (v: unknown): boolean =>
  v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'

const pickOption = (v: unknown, options: string[], fallback: string): string =>
  typeof v === 'string' && options.includes(v) ? v : fallback

const pickBool = (v: unknown, fallback: boolean): boolean => {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

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

const scalarToString = (v: unknown): string => {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  return String(v)
}

const util: Utility = {
  id: 'json_to_query_string',
  name: 'json to query string',
  category: 'Web & Dev',
  description:
    'Turn JSON into a URL query string, with bracket, repeat, comma or index array formats, bracket, dot or json nesting, optional percent-encoding, key sorting and a leading question mark.',
  accepts: 'string',
  produces: 'string',
  tags: ['json', 'query string', 'url encode', 'serialize', 'form data', 'querystring'],
  aliases: ['qs.stringify'],
  examples: [
    {
      title: 'object with an array field',
      input: JSON.stringify({ q: 'hello world', tags: ['a', 'b'] }),
      params: { arrayFormat: 'repeat', nested: 'bracket', encode: true },
      output: 'q=hello%20world&tags=a&tags=b'
    }
  ],
  params: {
    arrayFormat: {
      kind: 'select',
      label: 'array format',
      options: ['bracket', 'repeat', 'comma', 'index'],
      default: 'repeat'
    },
    nested: {
      kind: 'select',
      label: 'nested objects',
      options: ['bracket', 'dot', 'json'],
      default: 'bracket'
    },
    encode: { kind: 'boolean', label: 'percent-encode', default: true },
    sort: { kind: 'boolean', label: 'sort keys', default: false },
    prefix: { kind: 'boolean', label: 'leading ?', default: false }
  },
  apply: (input: any, params: any) => {
    const arrayFormat = pickOption(params?.arrayFormat, ['bracket', 'repeat', 'comma', 'index'], 'repeat')
    const nested = pickOption(params?.nested, ['bracket', 'dot', 'json'], 'bracket')
    const encode = pickBool(params?.encode, true)
    const sort = pickBool(params?.sort, false)
    const prefix = pickBool(params?.prefix, false)

    const data = parseJsonInput(input)
    if (data === undefined) return ''

    if (!isPlainObject(data) && !Array.isArray(data)) {
      throw new Error('json to query string expects a JSON object or array at the root')
    }

    const encValue = (s: string) => (encode ? encodeURIComponent(s) : s)
    // Structural brackets stay readable; everything else in a key is escaped.
    const encKey = (s: string) =>
      encode ? encodeURIComponent(s).replace(/%5B/g, '[').replace(/%5D/g, ']') : s

    const pairs: Pair[] = []

    const walk = (value: unknown, path: string): void => {
      if (value === undefined) return

      if (nested === 'json' && path !== '' && (Array.isArray(value) || isPlainObject(value))) {
        pairs.push({ key: path, value: JSON.stringify(value) })
        return
      }

      if (Array.isArray(value)) {
        if (value.length === 0) return
        if (arrayFormat === 'comma' && value.every(isScalar)) {
          pairs.push({
            key: path,
            value: value.map(v => encValue(scalarToString(v))).join(','),
            preEncoded: true
          })
          return
        }
        // 'comma' cannot express structured members — fall back to explicit indices.
        const format = arrayFormat === 'comma' ? 'index' : arrayFormat
        value.forEach((item, i) => {
          let childPath: string
          if (path === '') childPath = String(i)
          else if (format === 'repeat') childPath = path
          else if (format === 'bracket') childPath = `${path}[]`
          else childPath = nested === 'dot' ? `${path}.${i}` : `${path}[${i}]`
          walk(item, childPath)
        })
        return
      }

      if (isPlainObject(value)) {
        for (const key of Object.keys(value)) {
          const childPath =
            path === '' ? key : nested === 'dot' ? `${path}.${key}` : `${path}[${key}]`
          walk(value[key], childPath)
        }
        return
      }

      pairs.push({ key: path, value: scalarToString(value) })
    }

    walk(data, '')

    if (sort) {
      pairs.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    }

    const query = pairs
      .map(p => `${encKey(p.key)}=${p.preEncoded ? p.value : encValue(p.value)}`)
      .join('&')

    if (!query) return ''
    return prefix ? `?${query}` : query
  }
}

export default util
