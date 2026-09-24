// src/utilities/pipeline.types.test.ts
import { runPipeline } from '@/utilities';
import { isBytes } from '@/utilities/helpers';
import { describe, it, expect } from 'vitest';

describe('pipeline types', () => {
  it('string → get_bytes → hex_encode produces hex string', async () => {
    const steps = [
      { id: 's1', utilityId: 'get_bytes', enabled: true, params: {} },
      { id: 's2', utilityId: 'hex_encode', enabled: true, params: {} },
    ];
    const { out } = await runPipeline('abc', steps);
    expect(typeof out).toBe('string')
    expect(out).toBe('616263') // hex of [97, 98, 99]
  });

  it('string → get_bytes → md5(bytes) → hex string', async () => {
    const steps = [
      { id: 's1', utilityId: 'get_bytes', enabled: true, params: {} },
      { id: 's2', utilityId: 'md5', enabled: true, params: {} },
      { id: 's3', utilityId: 'hex_encode', enabled: true, params: {} },
    ];
    const { out } = await runPipeline('abc', steps);
    expect(out).toBe('900150983cd24fb0d6963f7d28e17f72'); // md5('abc')
  });

  it('get_bytes returns Uint8Array("abc")', async () => {
    const steps = [{ id: 's1', utilityId: 'get_bytes', enabled: true, params: {} }];
    const { out } = await runPipeline('abc', steps);
    expect(isBytes(out)).toBe(true);
    expect(Array.from(out as Uint8Array)).toEqual([97, 98, 99]);
  });
});
