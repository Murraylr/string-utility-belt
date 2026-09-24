// src/utilities/pipeline.types.test.ts
import { runPipeline } from '@/utilities';
import { isUint8Array } from 'util/types';
import { describe, it, expect } from 'vitest';

describe('pipeline types', () => {
  it('string → get_bytes → md5(bytes) → hex string', async () => {
    const steps = [
      { id: 's1', utilityId: 'get_bytes', params: {} },
      { id: 's2', utilityId: 'md5', params: {} }, // input bytes, returns bytes (16)
      { id: 's3', utilityId: 'hex_encode', params: {} }, // turn bytes digest into hex
    ];
    const { out, previews } = await runPipeline('abc', steps, true);
    expect(Object.keys(previews)).toEqual(['s1', 's2', 's3']);
    // md5('abc') should be 900150983cd24fb0d6963f7d28e17f72
    expect(out).toBe('900150983cd24fb0d6963f7d28e17f72');
  });

  it('get_bytes returns Uint8Array(“abc”)', async () => {
    const steps = [{ id: 's1', utilityId: 'get_bytes', params: {} }];
    const { out } = await runPipeline('abc', steps);
    expect(isUint8Array(out)).toBe(true);
    expect(Array.from(out as Uint8Array)).toEqual([97, 98, 99]);
  });
});
