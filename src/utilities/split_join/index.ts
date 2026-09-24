import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'split_join',
  name: 'split & join',
  category: 'String Ops',
  description: 'Split by one delimiter and rejoin with another.',
  accepts: 'string',
  produces: 'string',
  tags: ['split string', 'join string', 'change delimiter', 'csv to lines', 'delimiter conversion'],
  examples: [
    { title: 'commas to pipes', input: 'a,b,c', params: { splitBy: ',', joinWith: ' | ' }, output: 'a | b | c' }
  ],
  params: {
    splitBy: { kind: 'string', label: 'split by', default: ',' },
    joinWith: { kind: 'string', label: 'join with', default: '\n' }
  },
  apply: (input: any, { splitBy, joinWith }: any) => {
    const s = String(input)
    const sp = splitBy ?? ','
    const jw = joinWith ?? '\n'
    return s.split(sp).join(jw)
  }
}
export default util
