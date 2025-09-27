import util from './index'

describe('custom_function utility', () => {
  it('executes valid code', async () => {
    const out = await util.apply('abc', { code: 'return input.toUpperCase();' })
    expect(out).toBe('ABC')
  })

  it('handles errors gracefully', async () => {
    const out = await util.apply('abc', { code: 'throw new Error("fail")' })
    expect(out).toBe('abc') // falls back to input
  })

  it('times out gracefully', async () => {
    const out = await util.apply('abc', { code: 'while(true){}' })
    expect(out).toBe('abc') // falls back
  })
})
