
import { describe, it, expect } from 'vitest'
import { UTILITIES, UTIL_MAP, runPipeline } from './index'

describe('utilities index', () => {
  it('has unique ids', () => {
    const ids = UTILITIES.map(u => u.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('pipeline runs basic chain', async () => {
    const steps = [
      { id:'1', utilityId:'trim', params:{}, enabled:true },
      { id:'2', utilityId:'case', params:{mode:'upper'}, enabled:true },
      { id:'3', utilityId:'slug', params:{}, enabled:true },
    ]
    const { out } = await runPipeline('  Héllo World  ', steps)
    expect(out).toBe('hello-world')
  })
  it('includes md5 utility', () => {
    expect(!!UTIL_MAP['md5']).toBe(true)
  })
})
