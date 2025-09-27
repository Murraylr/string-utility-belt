import { describe, it, expect } from 'vitest'
import util from './index'
import { textToUint8Array } from '../helpers'

describe('base64_encode', () => {
  it('encodes string', async () => {
    const out = await util.apply('hi', {})
    expect(out).toBe('aGk=')
  })
  it('encodes bytes', async () => {
    const out = await util.apply(textToUint8Array('ok'), {})
    expect(out).toBe('b2s=')
  })
})
