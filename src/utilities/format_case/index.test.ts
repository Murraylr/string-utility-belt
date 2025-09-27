import { describe, it, expect } from 'vitest'
import util from './index'

describe('format_case', () => {
  it('to camel', async () => {
    const out = await util.apply('Hello world', { mode: 'camel' })
    expect(out).toBe('helloWorld')
  })
})
