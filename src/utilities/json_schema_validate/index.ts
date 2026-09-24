import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

type Err = { path: string; message: string }

const MISSING = Symbol('missing')
const MAX_REF_DEPTH = 64

/* ------------------------------------------------------------------ *
 * Small helpers
 * ------------------------------------------------------------------ */

const typeName = (v: unknown): string =>
  v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v

function matchesType(v: unknown, t: string): boolean {
  if (t === 'integer') return typeof v === 'number' && Number.isInteger(v)
  if (t === 'number') return typeof v === 'number'
  return typeName(v) === t
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((x, i) => deepEqual(x, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object)
    const kb = Object.keys(b as object)
    if (ka.length !== kb.length) return false
    return ka.every(
      (k) =>
        Object.prototype.hasOwnProperty.call(b, k) &&
        deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])
    )
  }
  return false
}

/** Order-independent canonical form, so equality is a string compare. */
function canonical(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (v === null || typeof v !== 'object') return JSON.stringify(v) as string
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`
  const obj = v as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`).join(',')}}`
}

/** Linear rather than O(n^2) — the pipeline re-runs on every keystroke. */
function firstDuplicate(items: unknown[]): [number, number] | null {
  const seen = new Map<string, number>()
  for (let i = 0; i < items.length; i++) {
    const key = canonical(items[i])
    const prev = seen.get(key)
    if (prev !== undefined) return [prev, i]
    seen.set(key, i)
  }
  return null
}

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/
const childPath = (path: string, key: string) =>
  IDENT_RE.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

/** Resolve a local JSON pointer such as `#/definitions/Address`. */
function resolvePointer(ref: string, root: unknown): unknown | typeof MISSING {
  if (ref === '#' || ref === '#/') return root
  if (!ref.startsWith('#/')) return MISSING
  let cur: unknown = root
  for (const raw of ref.slice(2).split('/')) {
    let seg = raw
    try {
      seg = decodeURIComponent(raw)
    } catch {
      seg = raw
    }
    seg = seg.replace(/~1/g, '/').replace(/~0/g, '~')
    if (cur === null || typeof cur !== 'object') return MISSING
    if (Array.isArray(cur)) {
      const i = Number(seg)
      if (!Number.isInteger(i) || i < 0 || i >= cur.length) return MISSING
      cur = cur[i]
    } else {
      if (!has(cur as object, seg)) return MISSING
      cur = (cur as Record<string, unknown>)[seg]
    }
  }
  return cur
}

const FORMATS: Record<string, RegExp> = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  uri: /^[A-Za-z][A-Za-z0-9+.-]*:\S*$/,
  url: /^[A-Za-z][A-Za-z0-9+.-]*:\S*$/,
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  'date-time': /^\d{4}-\d{2}-\d{2}[Tt ]\d{2}:\d{2}:\d{2}(\.\d+)?([Zz]|[+-]\d{2}:\d{2})$/,
  ipv4: /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
}

/** Unknown formats are annotations, not assertions — they always pass. */
const checkFormat = (value: string, format: string): boolean => {
  const re = FORMATS[format]
  return re ? re.test(value) : true
}

/* ------------------------------------------------------------------ *
 * Validator
 *
 * `depth` counts *consecutive* $ref hops, which is what has to be bounded:
 * a cycle can only be closed through a $ref. It is reset whenever we descend
 * into a child value, because the data is finite and that recursion always
 * terminates — otherwise a recursive schema would falsely reject any document
 * nested more than MAX_REF_DEPTH levels deep.
 * ------------------------------------------------------------------ */

function validateValue(
  value: unknown,
  schema: unknown,
  path: string,
  root: unknown,
  depth: number
): Err[] {
  if (schema === undefined || schema === true) return []
  if (schema === false) return [{ path, message: 'no value is allowed here' }]
  if (schema === null || typeof schema !== 'object' || Array.isArray(schema)) {
    return [{ path, message: 'invalid schema: expected an object or a boolean' }]
  }
  const s = schema as Record<string, unknown>

  if (typeof s.$ref === 'string') {
    if (depth >= MAX_REF_DEPTH) return [{ path, message: '$ref nesting is too deep' }]
    const target = resolvePointer(s.$ref, root)
    if (target === MISSING) return [{ path, message: `cannot resolve $ref "${s.$ref}"` }]
    return validateValue(value, target, path, root, depth + 1)
  }

  const errors: Err[] = []
  const fail = (message: string, at = path) => errors.push({ path: at, message })

  if (s.type !== undefined) {
    const types = (Array.isArray(s.type) ? s.type : [s.type]).filter(
      (t): t is string => typeof t === 'string'
    )
    if (types.length && !types.some((t) => matchesType(value, t))) {
      fail(`expected type ${types.join(' or ')}, got ${typeName(value)}`)
    }
  }

  if (has(s, 'const') && !deepEqual(value, s.const)) {
    fail(`expected the constant ${JSON.stringify(s.const)}`)
  }
  if (Array.isArray(s.enum) && !s.enum.some((e) => deepEqual(value, e))) {
    fail(`expected one of ${s.enum.map((e) => JSON.stringify(e)).join(', ')}`)
  }

  if (typeof value === 'string') {
    const length = Array.from(value).length // code points, so emoji count as one
    if (typeof s.minLength === 'number' && length < s.minLength) {
      fail(`expected at least ${s.minLength} characters, got ${length}`)
    }
    if (typeof s.maxLength === 'number' && length > s.maxLength) {
      fail(`expected at most ${s.maxLength} characters, got ${length}`)
    }
    if (typeof s.pattern === 'string') {
      let re: RegExp | null = null
      try {
        re = new RegExp(s.pattern)
      } catch {
        fail(`invalid pattern in schema: ${s.pattern}`)
      }
      if (re && !re.test(value)) fail(`does not match pattern ${s.pattern}`)
    }
    if (typeof s.format === 'string' && !checkFormat(value, s.format)) {
      fail(`is not a valid ${s.format}`)
    }
  }

  if (typeof value === 'number') {
    if (typeof s.minimum === 'number' && value < s.minimum) fail(`expected >= ${s.minimum}, got ${value}`)
    if (typeof s.maximum === 'number' && value > s.maximum) fail(`expected <= ${s.maximum}, got ${value}`)
    if (typeof s.exclusiveMinimum === 'number' && value <= s.exclusiveMinimum) {
      fail(`expected > ${s.exclusiveMinimum}, got ${value}`)
    }
    if (typeof s.exclusiveMaximum === 'number' && value >= s.exclusiveMaximum) {
      fail(`expected < ${s.exclusiveMaximum}, got ${value}`)
    }
  }

  if (Array.isArray(value)) {
    if (typeof s.minItems === 'number' && value.length < s.minItems) {
      fail(`expected at least ${s.minItems} items, got ${value.length}`)
    }
    if (typeof s.maxItems === 'number' && value.length > s.maxItems) {
      fail(`expected at most ${s.maxItems} items, got ${value.length}`)
    }
    if (s.uniqueItems === true) {
      const dup = firstDuplicate(value)
      if (dup) fail(`items ${dup[0]} and ${dup[1]} are duplicates`)
    }
    if (Array.isArray(s.items)) {
      const tuple = s.items
      value.forEach((item, i) => {
        if (i < tuple.length) {
          errors.push(...validateValue(item, tuple[i], `${path}[${i}]`, root, 0))
        }
      })
    } else if (s.items !== undefined) {
      value.forEach((item, i) => {
        errors.push(...validateValue(item, s.items, `${path}[${i}]`, root, 0))
      })
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    if (Array.isArray(s.required)) {
      for (const key of s.required) {
        if (typeof key === 'string' && !has(obj, key)) fail(`missing required property "${key}"`)
      }
    }
    const props =
      s.properties && typeof s.properties === 'object' && !Array.isArray(s.properties)
        ? (s.properties as Record<string, unknown>)
        : {}
    for (const [key, sub] of Object.entries(props)) {
      if (has(obj, key)) {
        errors.push(...validateValue(obj[key], sub, childPath(path, key), root, 0))
      }
    }
    if (s.additionalProperties !== undefined && s.additionalProperties !== true) {
      const extras = Object.keys(obj).filter((k) => !has(props, k))
      for (const key of extras) {
        if (s.additionalProperties === false) {
          fail('additional property is not allowed', childPath(path, key))
        } else {
          errors.push(
            ...validateValue(obj[key], s.additionalProperties, childPath(path, key), root, 0)
          )
        }
      }
    }
  }

  if (Array.isArray(s.allOf)) {
    for (const sub of s.allOf) errors.push(...validateValue(value, sub, path, root, depth))
  }
  if (Array.isArray(s.anyOf)) {
    if (!s.anyOf.some((sub) => validateValue(value, sub, path, root, depth).length === 0)) {
      fail('does not match any schema in anyOf')
    }
  }
  if (Array.isArray(s.oneOf)) {
    const matched = s.oneOf.filter(
      (sub) => validateValue(value, sub, path, root, depth).length === 0
    ).length
    if (matched !== 1) {
      fail(
        matched === 0
          ? 'does not match any schema in oneOf'
          : `matches ${matched} schemas in oneOf, expected exactly 1`
      )
    }
  }
  if (s.not !== undefined && validateValue(value, s.not, path, root, depth).length === 0) {
    fail('must not match the "not" schema')
  }

  return errors
}

/* ------------------------------------------------------------------ *
 * Input handling
 * ------------------------------------------------------------------ */

function readJson(input: unknown, label: string): { empty: boolean; value: unknown } {
  if (input === null || input === undefined) return { empty: true, value: undefined }
  let text: string
  if (isBytes(input)) text = new TextDecoder().decode(input as Uint8Array)
  else if (typeof input === 'object') return { empty: false, value: input }
  else text = String(input)
  if (text.trim() === '') return { empty: true, value: undefined }
  try {
    return { empty: false, value: JSON.parse(text) }
  } catch (e) {
    throw new Error(`invalid ${label}: ${(e as Error).message}`)
  }
}

const util: Utility = {
  id: 'json_schema_validate',
  name: 'json schema validate',
  category: 'Data Formats',
  description:
    'Validate JSON against a JSON Schema (draft-07 subset covering type, properties, required, items, enum, const, pattern, format, ranges, lengths, uniqueItems, additionalProperties, anyOf/allOf/oneOf/not and local $ref), reporting every error with its path.',
  accepts: ['string', 'json'],
  produces: 'json',
  tags: ['json schema', 'validate', 'ajv', 'draft-07', 'schema check', 'lint json'],
  examples: [
    {
      title: 'document satisfies the schema',
      input: '{"id":1,"email":"ada@example.com"}',
      params: {
        schema: JSON.stringify({
          type: 'object',
          required: ['id', 'email'],
          properties: { id: { type: 'integer' }, email: { type: 'string', format: 'email' } },
        }),
      },
      output: '{\n  "valid": true,\n  "errors": []\n}',
    },
    {
      title: 'missing property and wrong type',
      input: '{"id":"x"}',
      params: {
        schema: JSON.stringify({
          type: 'object',
          required: ['id', 'email'],
          properties: { id: { type: 'integer' } },
        }),
      },
      output:
        '{\n  "valid": false,\n  "errors": [\n    {\n      "path": "$",\n      "message": "missing required property \\"email\\""\n    },\n    {\n      "path": "$.id",\n      "message": "expected type integer, got string"\n    }\n  ]\n}',
    },
  ],
  params: {
    schema: {
      kind: 'file',
      label: 'schema',
      default: '{}',
      placeholder: '{ "type": "object", "required": ["id"] }',
    },
  },
  apply: (input: any, params: any) => {
    const schemaText = params?.schema
    const schema =
      schemaText === undefined || schemaText === null || String(schemaText).trim() === ''
        ? {}
        : readJson(schemaText, 'schema JSON').value

    const { empty, value } = readJson(input, 'JSON input')
    if (empty) return { valid: false, errors: [{ path: '$', message: 'no input to validate' }] }

    const errors = validateValue(value, schema, '$', schema, 0)
    return { valid: errors.length === 0, errors }
  },
}

export default util
