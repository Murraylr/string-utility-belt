import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'hex_encode',
  name: 'hex encode',
  category: 'Encoding',
  description: 'Encode UTF‑8 text or bytes to hexadecimal string.',
  accepts: ['string','bytes'],
  produces: 'string',
  params: {},
  apply: (input: string): string => {
    return input.split("")
     .map(c => c.charCodeAt(0).toString(16).padStart(2, "0"))
     .join("");
}
}
export default util
