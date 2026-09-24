import type { Utility } from '@/types/utility'

type Container = Record<string, unknown>
type NestMode = 'auto' | 'bracket' | 'dot' | 'none'

const isPlainObject = (v: unknown): v is Container =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Every container is prototype-less: a key such as `a[__proto__][x]` must become
 * plain data instead of walking into (and writing through to) `Object.prototype`.
 */
const container = (): Container => Object.create(null) as Container

const hasOwn = (node: Container, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(node, key)

const pickOption = (v: unknown, options: string[], fallback: string): string =>
  typeof v === 'string' && options.includes(v) ? v : fallback

const pickBool = (v: unknown, fallback: boolean): boolean => {
  if (v === undefined || v === null || v === '') return fallback
  if (typeof v === 'string') return v !== 'false' && v !== '0'
  return Boolean(v)
}

const pickNumber = (v: unknown, fallback: number): number => {
  if (v === undefined || v === null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

const decodeComponent = (raw: string): string => {
  const plussed = raw.replace(/\+/g, ' ')
  try {
    return decodeURIComponent(plussed)
  } catch {
    throw new Error(`invalid percent-encoding in "${raw}"`)
  }
}

const NUMERIC = /^\d+$/
const CANONICAL_NUMBER = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/

const INTEGER = /^-?\d+$/

const coerce = (value: string, typed: boolean): unknown => {
  if (!typed) return value
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'null') return null
  if (CANONICAL_NUMBER.test(value)) {
    const n = Number(value)
    if (!Number.isFinite(n)) return value
    // Long ids (snowflakes, account numbers) would silently lose digits — keep them as text.
    if (INTEGER.test(value) && !Number.isSafeInteger(n)) return value
    return n
  }
  return value
}

/**
 * `a[b][]` -> ['a','b',''], and with `allowDots` also `a[].b` -> ['a','','b'].
 * null when the key is not cleanly structured, so the caller can keep it literal.
 */
const structuredSegments = (key: string, allowDots: boolean): string[] | null => {
  let head = 0
  while (head < key.length && key[head] !== '[' && !(allowDots && key[head] === '.')) head++
  if (head === 0 || head === key.length) return null
  const segments = [key.slice(0, head)]
  let rest = key.slice(head)
  while (rest.length > 0) {
    if (rest[0] === '[') {
      const m = /^\[([^[\]]*)\]/.exec(rest)
      if (!m) return null
      segments.push(m[1])
      rest = rest.slice(m[0].length)
    } else {
      const m = /^\.([^[\].]+)/.exec(rest)
      if (!m) return null
      segments.push(m[1])
      rest = rest.slice(m[0].length)
    }
  }
  return segments
}

const keySegments = (key: string, mode: NestMode): string[] => {
  if (mode === 'none') return [key]
  if (mode === 'bracket') return structuredSegments(key, false) ?? [key]
  if (mode === 'dot') {
    const parts = key.split('.').filter(p => p.length > 0)
    return parts.length > 0 ? parts : [key]
  }
  // auto: brackets and dots, in any mix
  return structuredSegments(key, true) ?? [key]
}

const numericKeys = (node: Container): number[] =>
  Object.keys(node)
    .filter(k => NUMERIC.test(k))
    .map(Number)
    .sort((a, b) => a - b)

const nextIndex = (node: Container): number => {
  const keys = numericKeys(node)
  return keys.length === 0 ? 0 : keys[keys.length - 1] + 1
}

/**
 * `a[][x]=1&a[][y]=2` should fill one element, while `a[][x]=1&a[][x]=2`
 * should start a new one — reuse the last element unless it already owns the key.
 */
const pushKeyForBranch = (node: Container, nextSegment: string): string => {
  const keys = numericKeys(node)
  if (keys.length === 0) return '0'
  const last = String(keys[keys.length - 1])
  const lastValue = node[last]
  if (isPlainObject(lastValue) && !hasOwn(lastValue, nextSegment)) {
    return last
  }
  return String(keys[keys.length - 1] + 1)
}

const parseQuery = (query: string, mode: NestMode, typed: boolean): unknown => {
  const root: Container = container()
  const arrayish = new Set<object>()

  for (const chunk of query.split('&')) {
    if (chunk === '') continue
    const eq = chunk.indexOf('=')
    const rawKey = eq < 0 ? chunk : chunk.slice(0, eq)
    const rawValue = eq < 0 ? '' : chunk.slice(eq + 1)
    const key = decodeComponent(rawKey)
    if (key === '') continue
    const value = coerce(decodeComponent(rawValue), typed)
    const segments = keySegments(key, mode)

    let node: Container = root
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i]
      let childKey: string
      if (segment === '') {
        childKey = pushKeyForBranch(node, segments[i + 1])
        arrayish.add(node)
      } else {
        childKey = segment
        if (node !== root && NUMERIC.test(segment)) arrayish.add(node)
      }
      const existing = hasOwn(node, childKey) ? node[childKey] : undefined
      if (existing === undefined) {
        const child: Container = container()
        node[childKey] = child
        node = child
      } else if (isPlainObject(existing)) {
        node = existing
      } else {
        throw new Error(`conflicting values for key "${key}"`)
      }
    }

    const lastSegment = segments[segments.length - 1]
    let leafKey: string
    if (lastSegment === '') {
      leafKey = String(nextIndex(node))
      arrayish.add(node)
    } else {
      leafKey = lastSegment
      if (node !== root && NUMERIC.test(lastSegment)) arrayish.add(node)
    }

    const existing = hasOwn(node, leafKey) ? node[leafKey] : undefined
    if (existing === undefined) node[leafKey] = value
    else if (Array.isArray(existing)) existing.push(value)
    else if (isPlainObject(existing)) throw new Error(`conflicting values for key "${key}"`)
    else node[leafKey] = [existing, value]
  }

  const finalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(finalize)
    if (isPlainObject(value)) {
      const keys = Object.keys(value)
      const out: Container = container()
      for (const k of keys) out[k] = finalize(value[k])
      if (arrayish.has(value) && keys.length > 0 && keys.every((k, i) => k === String(i))) {
        return keys.map(k => out[k])
      }
      return out
    }
    return value
  }

  return finalize(root)
}

const util: Utility = {
  id: 'query_string_to_json',
  name: 'query string to json',
  category: 'Web & Dev',
  description:
    'Parse a query string or URL into JSON, understanding a[b], a.b, a[] and repeated keys, with auto, bracket, dot or none nesting, optional value typing and a configurable indent.',
  accepts: 'string',
  produces: 'string',
  tags: ['query string', 'url', 'parse', 'json', 'bracket notation', 'querystring'],
  aliases: ['qs.parse'],
  examples: [
    {
      title: 'repeated key becomes an array, values typed',
      input: 'a=1&b=2&b=3',
      params: { nested: 'auto', typed: true, indent: 2 },
      output: '{\n  "a": 1,\n  "b": [\n    2,\n    3\n  ]\n}'
    }
  ],
  params: {
    nested: {
      kind: 'select',
      label: 'nesting',
      options: ['auto', 'bracket', 'dot', 'none'],
      default: 'auto'
    },
    typed: { kind: 'boolean', label: 'coerce numbers/booleans', default: false },
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 10, integer: true }
  },
  apply: (input: any, params: any) => {
    const mode = pickOption(params?.nested, ['auto', 'bracket', 'dot', 'none'], 'auto') as NestMode
    const typed = pickBool(params?.typed, false)
    const indent = Math.max(0, Math.min(10, Math.floor(pickNumber(params?.indent, 2))))

    let query = String(input ?? '').trim()
    const questionMark = query.indexOf('?')
    if (questionMark >= 0) {
      query = query.slice(questionMark + 1)
    } else if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(query)) {
      // a full URL with no '?' carries no parameters — don't parse its path as one
      query = ''
    }
    const hash = query.indexOf('#')
    if (hash >= 0) query = query.slice(0, hash)
    query = query.replace(/^&+/, '')

    if (query === '') return JSON.stringify({}, null, indent)

    return JSON.stringify(parseQuery(query, mode, typed), null, indent)
  }
}

export default util
