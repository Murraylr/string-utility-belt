import { Utility } from '@/types/utility';
import { Value, isBytes } from '@/types/values';

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    // Build binary string safely
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk) as number[]);
    }
    return btoa(binary);
  }
  // Node
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return Buffer.from(bytes).toString('base64');
}

const util: Utility = {
  id: 'base64_encode',
  name: 'base64_encode',
  description: 'Encode a string or bytes to Base64 (no newlines).',
  category: 'Encoding',
  accepts: ['string', 'bytes'],
  produces: 'string',
  params: {},
  async apply(input: Value): Promise<string> {
    const bytes = isBytes(input) ? input : new TextEncoder().encode(input);
    return bytesToBase64(bytes);
  }
};

export default util;
