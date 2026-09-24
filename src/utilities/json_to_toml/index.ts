import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

// Lazily imported + cached: the registry eagerly globs every utility module, so
// a top-level `smol-toml` import would be bundled into the initial payload and
// re-resolved on every pipeline run.
let _toml: typeof import('smol-toml') | null = null
async function getToml() {
  if (!_toml) _toml = await import('smol-toml')
  return _toml
}

/** True when there is nothing to convert yet — an empty box is not an error. */
function isEmptyInput(input: unknown): boolean {
  if (isBytes(input)) return (input as Uint8Array).length === 0
  if (input !== null && typeof input === 'object') return false
  return String(input ?? '').trim() === ''
}

/**
 * Reads a JSON document from a string, raw bytes, or an already-structured
 * value handed over by an upstream step.
 */
function readJson(input: unknown): unknown {
  let value: unknown = input
  if (isBytes(value)) value = new TextDecoder().decode(value as Uint8Array)
  if (value !== null && typeof value === 'object') return value
  const text = String(value ?? '')
  try {
    return JSON.parse(text)
  } catch (e) {
    throw new Error(`invalid JSON: ${(e as Error).message}`)
  }
}

function describe(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'an array'
  return `a ${typeof value}`
}

/**
 * TOML has no null literal. smol-toml quietly omits null-valued keys from
 * tables (while throwing for a null inside an array), so converting
 * `{"a": null}` would hand back an empty document and lose the key without
 * saying so. Report it instead — silent data loss is worse than an error.
 */
function assertNoNulls(value: unknown, path: string): void {
  if (value === null || value === undefined) {
    throw new Error(`TOML has no null: "${path}" is null — drop the key or give it a value first`)
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoNulls(item, `${path}[${i}]`))
    return
  }
  if (typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      assertNoNulls(item, path ? `${path}.${key}` : key)
    }
  }
}

const util: Utility = {
  id: 'json_to_toml',
  name: 'json to toml',
  category: 'Data Formats',
  description: 'Convert a JSON object to TOML, turning nested objects into tables and object arrays into array-of-table sections; null values are reported rather than dropped.',
  accepts: 'string',
  produces: 'string',
  tags: ['toml', 'json', 'convert', 'config', 'smol-toml', 'serialize'],
  examples: [
    {
      title: 'scalars and an array',
      input: '{"title":"belt","port":8080,"tags":["cli","text"]}',
      output: 'title = "belt"\nport = 8080\ntags = [ "cli", "text" ]\n'
    },
    {
      title: 'nested object becomes a table',
      input: '{"owner":{"name":"Ann","active":true}}',
      output: '[owner]\nname = "Ann"\nactive = true\n'
    }
  ],
  params: {},
  apply: async (input: any) => {
    if (isEmptyInput(input)) return ''
    const data = readJson(input)
    if (data === null || typeof data !== 'object' || Array.isArray(data)) {
      throw new Error(`TOML needs a top-level object, got ${describe(data)}`)
    }
    assertNoNulls(data, '')
    const TOML = await getToml()
    let out: string
    try {
      out = TOML.stringify(data as Record<string, unknown>)
    } catch (e) {
      throw new Error(`could not convert to TOML: ${(e as Error).message}`)
    }
    // smol-toml emits a lone newline for `{}`; an empty document is empty text.
    return out.trim() === '' ? '' : out
  }
}

export default util
