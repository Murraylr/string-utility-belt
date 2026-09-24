import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'json_minify',
  name: 'json minify',
  category: 'URL & JSON',
  description: 'Parse and re-serialize JSON with no whitespace.',
  accepts: 'string',
  produces: 'string',
  tags: ['json', 'minify', 'compact', 'whitespace', 'compress', 'shrink', 'squeeze'],
  params: {},
  examples: [
    {
      title: 'strip formatting',
      input: '{\n  "a": 1,\n  "b": [1, 2, 3]\n}',
      output: '{"a":1,"b":[1,2,3]}'
    }
  ],
  apply: (input: any) => {
    // an empty box is not a JSON error the user needs to see yet
    if (String(input).trim() === '') return ''
    return JSON.stringify(JSON.parse(String(input)))
  }
}
export default util
