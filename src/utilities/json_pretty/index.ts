import type { Utility } from '@/types/utility'
import { } from '../helpers'
const util: Utility = {
  id: 'json_pretty',
  name: 'json pretty',
  category: 'URL & JSON',
  description: 'Parse input as JSON and pretty-print.',
  accepts: ['string'],
  produces: 'string',
  tags: ['json', 'pretty print', 'format', 'indent', 'beautify', 'formatter'],
  aliases: ['jq'],
  params: { indent: { kind: 'number', label: 'indent', default: 2, min: 0, integer: true, max: 10 } },
  examples: [
    {
      title: 'default 2-space indent',
      input: '{"a":1,"b":[1,2,3]}',
      output: '{\n  "a": 1,\n  "b": [\n    1,\n    2,\n    3\n  ]\n}'
    },
    {
      title: '4-space indent',
      input: '{"a":1}',
      params: { indent: 4 },
      output: '{\n    "a": 1\n}'
    }
  ],
  apply: (input: any, { indent }: any) => {
    // an empty box is not a JSON error the user needs to see yet
    if (String(input).trim() === '') return ''
    const val = JSON.parse(input)
    return JSON.stringify(val, null, Math.max(0, Number(indent ?? 2) || 0))
  }
}
export default util
