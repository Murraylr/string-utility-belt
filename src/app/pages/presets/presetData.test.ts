import { describe, expect, it } from 'vitest'
import { PRESET_INDEX } from '@/presets/_generated/index'
import { loadPresetData, peekPresetData } from './presetData'

describe('preset data', () => {
  it('loads a preset with its guide title, description and rendered body, then serves it synchronously', async () => {
    const slug = PRESET_INDEX[0].slug
    const data = await loadPresetData(slug)
    expect(data?.preset.slug).toBe(slug)
    expect(data?.title.length).toBeGreaterThan(0)
    expect(data?.description.length).toBeGreaterThan(0)
    expect(data?.guideHtml).toMatch(/<h2/)
    expect(data?.guideHtml).not.toContain('title:')
    expect(peekPresetData(slug)).toBe(data)
    expect(await loadPresetData(slug)).toBe(data)
  })

  it('answers null for a slug with no preset, including names on Object.prototype', async () => {
    for (const slug of ['no-such-preset', 'constructor', 'hasownproperty', '__proto__']) {
      expect(await loadPresetData(slug), slug).toBeNull()
      expect(peekPresetData(slug), slug).toBeNull()
    }
  })

  it('reports nothing before a load has finished', () => {
    expect(peekPresetData('never-requested')).toBeUndefined()
  })
})
