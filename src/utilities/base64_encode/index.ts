import type { Utility } from '../../types/utility';
import { type Value, isBytes } from '../../types/values';

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
   
  return Buffer.from(bytes).toString('base64');
}

const util: Utility = {
  id: 'base64_encode',
  name: 'base64_encode',
  description: 'Encode a string or bytes to Base64 (no newlines).',
  category: 'Encoding',
  accepts: ['string', 'bytes'],
  produces: 'string',
  tags: ['base64', 'encode', 'b64', 'mime', 'binary', 'text'],
  aliases: ['btoa'],
  params: {},
  examples: [
    { title: 'plain text', input: 'hello world', output: 'aGVsbG8gd29ybGQ=' },
    { title: 'raw bytes', input: '48656c6c6f', inputEncoding: 'hex', output: 'SGVsbG8=' }
  ],
  async apply(input: Value): Promise<string> {
    const bytes = isBytes(input) ? input : new TextEncoder().encode(input);
    return bytesToBase64(bytes);
  }
};

export default util;
