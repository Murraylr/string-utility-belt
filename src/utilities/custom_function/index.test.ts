import { describe, it, expect } from 'vitest'
import util from './index'

describe('custom_function', () => {
  it('expression mode', async () => {
    const out: any = await util.apply('ab', { code: 'input + input', async: false })
    expect(out).toBe('abab')
  })
  it('body with return', async () => {
    const out: any = await util.apply('ab', { code: 'return input.toUpperCase();', async: false })
    expect(out).toBe('AB')
  })
})
