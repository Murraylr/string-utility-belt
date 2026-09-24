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

/** Accepts a string, raw bytes, or a structured value from an upstream step. */
function toText(input: unknown): string {
  if (isBytes(input)) return new TextDecoder().decode(input as Uint8Array)
  if (input !== null && typeof input === 'object') return JSON.stringify(input)
  return String(input ?? '')
}

/**
 * Reads a number param, falling back to the declared default when the step has
 * no value for it. Clearing a number box in ParamsEditor stores `''`, and
 * `Number('')` is 0 — without this guard an empty indent box would silently
 * minify the output instead of using the default indent of 2.
 */
function intParam(value: unknown, fallback: number, min: number, max: number): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string' && value.trim() === '') return fallback
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

const util: Utility = {
  id: 'toml_to_json',
  name: 'toml to json',
  category: 'Data Formats',
  description: 'Convert TOML to JSON with a configurable indent; dates become ISO 8601 strings.',
  accepts: 'string',
  produces: 'string',
  params: {
    indent: { kind: 'number', label: 'indent (0 = minified)', default: 2, min: 0, max: 10, integer: true }
  },
  tags: ['toml', 'json', 'config', 'convert', 'ini', 'cargo', 'pyproject'],
  examples: [
    {
      title: 'table becomes a nested object',
      input: 'name = "example"\nport = 8080\n[owner]\nname = "Bob"',
      output: '{\n  "name": "example",\n  "port": 8080,\n  "owner": {\n    "name": "Bob"\n  }\n}'
    },
    {
      title: 'minified',
      input: 'name = "x"',
      params: { indent: 0 },
      output: '{"name":"x"}'
    }
  ],
  apply: async (input: any, params: any) => {
    const text = toText(input)
    if (text.trim() === '') return ''
    const TOML = await getToml()
    const indent = intParam(params?.indent, 2, 0, 10)
    let data: unknown
    try {
      data = TOML.parse(text)
    } catch (e) {
      throw new Error(`invalid TOML: ${(e as Error).message}`)
    }
    return JSON.stringify(data, null, indent)
  }
}

export default util
