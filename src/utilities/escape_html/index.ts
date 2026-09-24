import type { Utility } from '@/types/utility'

const MAP: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}

const util: Utility = {
  id: 'escape_html',
  name: 'escape HTML',
  category: 'Encoding',
  description: 'Escape &, <, >, ", and \' to HTML entities.',
  accepts: 'string',
  produces: 'string',
  tags: ['html', 'entity', 'encode', 'escape', 'xss', 'sanitize'],
  aliases: ['htmlspecialchars', 'html_entity_encode'],
  streamable: true,
  params: {},
  examples: [
    {
      title: 'special characters',
      input: 'Tom & Jerry <3> "quotes" \'single\'',
      output: 'Tom &amp; Jerry &lt;3&gt; &quot;quotes&quot; &#39;single&#39;'
    }
  ],
  apply: (input: any) => String(input).replace(/[&<>"']/g, ch => MAP[ch])
}
export default util
