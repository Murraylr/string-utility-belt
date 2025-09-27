
import { describe, it, expect } from 'vitest'
import { runPipeline } from './index'

describe('runPipeline', () => {
  it('chains basic utilities', async () => {
    const steps = [
      { id:'1', utilityId:'trim', enabled:true, params:{} },
      { id:'2', utilityId:'case', enabled:true, params:{ mode:'upper' } },
    ]
    const { out } = await runPipeline('  hi  ', steps)
    expect(out).toBe('HI')
  })
})
