import type { Utility } from '@/types/utility'

const clampIndent = (v: unknown, fallback = 2): number => {
  const n = Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.min(10, Math.max(0, Math.floor(n)))
}

const util: Utility = {
  id: 'jsonl_to_json',
  name: 'jsonl to json',
  category: 'Data Formats',
  description:
    'Collect newline-delimited JSON (one value per line) into a single JSON array, optionally skipping blank lines or skipping lines that fail to parse.',
  accepts: 'string',
  produces: 'string',
  tags: ['jsonl', 'ndjson', 'json lines', 'newline delimited json', 'collect array'],
  aliases: ['ndjson'],
  examples: [
    {
      title: 'two records into an array',
      input: '{"id":1,"name":"Ada"}\n{"id":2,"name":"Grace"}',
      output: '[\n  {\n    "id": 1,\n    "name": "Ada"\n  },\n  {\n    "id": 2,\n    "name": "Grace"\n  }\n]'
    },
    {
      title: 'skip blank and invalid lines',
      input: '{"id":1,"name":"Ada"}\n\nnot json\n{"id":2,"name":"Grace"}',
      params: { onError: 'skip' },
      output: '[\n  {\n    "id": 1,\n    "name": "Ada"\n  },\n  {\n    "id": 2,\n    "name": "Grace"\n  }\n]'
    }
  ],
  params: {
    indent: { kind: 'number', label: 'indent', default: 2, min: 0, max: 10, integer: true },
    skipBlank: { kind: 'boolean', label: 'skip blank lines', default: true },
    onError: {
      kind: 'select',
      label: 'on invalid line',
      options: ['error', 'skip'],
      default: 'error'
    }
  },
  apply: (input: any, { indent, skipBlank, onError }: any) => {
    const raw = (typeof input === 'string' ? input : String(input ?? '')).replace(/^\uFEFF/, '')
    const ind = clampIndent(indent)
    if (raw.trim() === '') return '[]'

    const skipEmpty = skipBlank !== false
    const mode = String(onError ?? 'error') === 'skip' ? 'skip' : 'error'

    const lines = raw.split(/\r\n|\r|\n/)
    // a single trailing newline is a file convention, not an empty record
    if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop()

    const out: unknown[] = []
    for (let k = 0; k < lines.length; k++) {
      const line = lines[k].trim()
      if (line === '') {
        if (skipEmpty || mode === 'skip') continue
        throw new Error(
          `jsonl: line ${k + 1} is blank — enable "skip blank lines" to ignore it`
        )
      }
      try {
        out.push(JSON.parse(line))
      } catch (e) {
        if (mode === 'skip') continue
        const reason = e instanceof Error ? e.message : String(e)
        throw new Error(`jsonl: line ${k + 1} is not valid JSON — ${reason}`)
      }
    }
    return JSON.stringify(out, null, ind)
  }
}

export default util
