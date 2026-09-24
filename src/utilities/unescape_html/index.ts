import type { Utility } from '@/types/utility'

const MAP: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&#x27;': "'", '&#x2F;': '/', '&apos;': "'"
}

const util: Utility = {
  id: 'unescape_html',
  name: 'unescape HTML',
  category: 'Decoding',
  description: 'Decode HTML entities back to characters.',
  accepts: 'string',
  produces: 'string',
  tags: ['html', 'entity', 'decode', 'unescape', 'entities', 'amp'],
  aliases: ['html_entity_decode', 'htmlspecialchars_decode'],
  streamable: true,
  params: {},
  examples: [
    { title: 'basic entities', input: 'Tom &amp; Jerry &lt;3&gt;', output: 'Tom & Jerry <3>' },
    { title: 'quotes', input: 'It&#39;s &quot;fine&quot;', output: 'It\'s "fine"' }
  ],
  apply: (input: any) => String(input).replace(
    /&(?:amp|lt|gt|quot|apos|#39|#x27|#x2F);/g,
    entity => MAP[entity] ?? entity
  )
}
export default util
