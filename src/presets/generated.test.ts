import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { build, PRESETS_GENERATED_DIR } from '../../scripts/gen-presets'
import { PRESET_INDEX } from './_generated/index'
import { PRESET_LOADERS } from './_generated/loaders'
import { STATIC_PRESETS } from './_generated/static'

describe('generated preset index', () => {
  it('is up to date — run `npm run gen` if this fails', async () => {
    const { files } = await build()
    const stale = Object.entries(files)
      .filter(([name, content]) => readFileSync(path.join(PRESETS_GENERATED_DIR, name), 'utf8') !== content)
      .map(([name]) => name)
    expect(stale).toEqual([])
  }, 120000)

  it('covers the same presets in the index, the loaders and the static list', () => {
    const slugs = STATIC_PRESETS.map(r => r.slug).sort()
    expect(PRESET_INDEX.map(m => m.slug).sort()).toEqual(slugs)
    expect(Object.keys(PRESET_LOADERS).sort()).toEqual(slugs)
  })

  it('carries metadata only in the index — no steps or samples', () => {
    for (const m of PRESET_INDEX) {
      expect(m).not.toHaveProperty('steps')
      expect(m).not.toHaveProperty('samples')
    }
  })

  it('loads a preset and its guide markdown through its lazy loader', async () => {
    const slug = PRESET_INDEX[0].slug
    const { preset, guide } = await PRESET_LOADERS[slug]()
    expect(preset.slug).toBe(slug)
    expect(guide).toMatch(/^---\ntitle: /)
  })
})
