import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

// Lazily imported + cached: the registry eagerly globs every utility module, so
// a top-level `yaml` import would be bundled into the app's initial payload.
let _yaml: typeof import('yaml') | null = null
async function getYaml() {
  if (!_yaml) _yaml = await import('yaml')
  return _yaml
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
  id: 'yaml_to_json',
  name: 'yaml to json',
  category: 'Data Formats',
  description: 'Convert YAML to JSON with a configurable indent; a multi-document stream becomes an array, and "all documents" always emits one.',
  accepts: 'string',
  produces: 'string',
  params: {
    indent: { kind: 'number', label: 'indent (0 = minified)', default: 2, min: 0, max: 10, integer: true },
    allDocuments: { kind: 'boolean', label: 'always emit an array of documents', default: false }
  },
  tags: ['yaml', 'yml', 'json', 'convert', 'config', 'kubernetes', 'ansible'],
  examples: [
    {
      title: 'mapping to object',
      input: 'name: Ann\nage: 30',
      output: '{\n  "name": "Ann",\n  "age": 30\n}'
    },
    {
      title: 'multi-document stream',
      input: '---\na: 1\n---\nb: 2',
      params: { allDocuments: true },
      output: '[\n  {\n    "a": 1\n  },\n  {\n    "b": 2\n  }\n]'
    }
  ],
  apply: async (input: any, params: any) => {
    const text = toText(input)
    if (text.trim() === '') return ''
    const YAML = await getYaml()
    const indent = intParam(params?.indent, 2, 0, 10)
    const allDocuments = params?.allDocuments === true

    let values: unknown[]
    try {
      const docs = YAML.parseAllDocuments(text, { prettyErrors: true })
      for (const doc of docs) {
        if (doc.errors.length) throw new Error(doc.errors[0].message)
      }
      values = docs.map((doc) => {
        const value = doc.toJS()
        return value === undefined ? null : value
      })
    } catch (e) {
      throw new Error(`invalid YAML: ${(e as Error).message}`)
    }

    // A lone document unwraps to its own value; a stream of several becomes an
    // array. `allDocuments` forces the array form even for a single document.
    const out = allDocuments || values.length > 1 ? values : (values.length === 1 ? values[0] : null)

    try {
      return JSON.stringify(out, null, indent)
    } catch (e) {
      const message = (e as Error).message
      // Self-referential anchors are the common cause, but do not blame them for
      // an unrelated serialisation failure.
      if (/circular/i.test(message)) {
        throw new Error('YAML anchors form a circular reference, which JSON cannot represent')
      }
      throw new Error(`could not convert to JSON: ${message}`)
    }
  }
}

export default util
