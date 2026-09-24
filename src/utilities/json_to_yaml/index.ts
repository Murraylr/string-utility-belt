import type { Utility } from '@/types/utility'
import { isBytes } from '../helpers'

// The utility registry eagerly globs every module, so `yaml` must be pulled in
// lazily (and cached) rather than statically imported — otherwise it lands in
// the app's initial bundle and is re-imported on every pipeline keystroke.
let _yaml: typeof import('yaml') | null = null
async function getYaml() {
  if (!_yaml) _yaml = await import('yaml')
  return _yaml
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

/**
 * Reads a number param, falling back to the declared default when the step has
 * no value for it. Clearing a number box in ParamsEditor stores `''`, and
 * `Number('')` is 0 — without this guard an empty "line width" box would mean
 * "never wrap" and an empty "indent" box would mean an indent of 1.
 */
function intParam(value: unknown, fallback: number, min: number, max: number): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string' && value.trim() === '') return fallback
  const n = Math.round(Number(value))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

const util: Utility = {
  id: 'json_to_yaml',
  name: 'json to yaml',
  category: 'Data Formats',
  description: 'Convert JSON to YAML, with a configurable indent, wrapping line width, and optional alphabetical key sorting.',
  accepts: 'string',
  produces: 'string',
  tags: ['yaml', 'yml', 'json', 'convert', 'serialize', 'config'],
  examples: [
    {
      title: 'object with a nested array',
      input: '{"name":"belt","version":"1.2.0","tags":["cli","text"]}',
      output: 'name: belt\nversion: 1.2.0\ntags:\n  - cli\n  - text\n'
    }
  ],
  params: {
    indent: { kind: 'number', label: 'indent', default: 2, min: 1, max: 12, integer: true },
    lineWidth: { kind: 'number', label: 'line width (0 = never wrap)', default: 80, min: 0, max: 100000, integer: true },
    sortKeys: { kind: 'boolean', label: 'sort keys', default: false }
  },
  apply: async (input: any, params: any) => {
    if (isEmptyInput(input)) return ''
    const data = readJson(input)
    const YAML = await getYaml()
    const indent = intParam(params?.indent, 2, 1, 12)
    const lineWidth = intParam(params?.lineWidth, 80, 0, 100000)
    const sortKeys = params?.sortKeys === true
    try {
      return YAML.stringify(data, { indent, lineWidth, sortMapEntries: sortKeys })
    } catch (e) {
      throw new Error(`could not convert to YAML: ${(e as Error).message}`)
    }
  }
}

export default util
