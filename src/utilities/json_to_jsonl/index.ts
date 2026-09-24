import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'json_to_jsonl',
  name: 'json to jsonl',
  category: 'Data Formats',
  description:
    'Split a JSON array into newline-delimited JSON, writing one compact JSON value per line.',
  accepts: 'string',
  produces: 'string',
  tags: ['jsonl', 'ndjson', 'newline delimited json', 'json lines', 'split array'],
  aliases: ['ndjson'],
  examples: [
    {
      title: 'array of records',
      input: '[{"id":1,"name":"Ada"},{"id":2,"name":"Grace"}]',
      output: '{"id":1,"name":"Ada"}\n{"id":2,"name":"Grace"}'
    }
  ],
  params: {},
  apply: (input: any) => {
    const raw = (typeof input === 'string' ? input : String(input ?? '')).replace(/^\uFEFF/, '')
    if (raw.trim() === '') return ''

    let doc: unknown
    try {
      doc = JSON.parse(raw)
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e)
      throw new Error(`jsonl: input is not valid JSON — ${reason}`)
    }

    const items = Array.isArray(doc) ? doc : [doc]
    return items
      .map((v) => {
        const s = JSON.stringify(v)
        return s === undefined ? 'null' : s
      })
      .join('\n')
  }
}

export default util
