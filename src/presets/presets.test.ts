/**
 * Every shipped preset (`src/presets/<slug>/`) passes the rules in `check.ts`, run
 * with the engine the SEO build uses (the static registry in Node mode): the
 * build pre-renders each preset's worked example from these same runs.
 *
 * Check a few presets quickly:  npm run check:presets -- excel-column-to-sql-in-clause
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { runPipeline } from '../core/runner'
import { formatForDisplay } from '../core/coerce'
import { staticRegistry, STATIC_UTILITIES } from '../utilities/static-registry'
import { MANIFEST } from '../utilities/_generated/manifest'
import { STATIC_PRESETS } from './_generated/static'
import { checkPreset, checkPresetSet, type PresetCheckContext } from './check'
import { toPipelineSteps } from './types'

const DIR = path.join(process.cwd(), 'src', 'presets')
const readGuide = (slug: string): string | null => {
  const file = path.join(DIR, slug, 'guide.md')
  return existsSync(file) ? readFileSync(file, 'utf8') : null
}
const byId = new Map(STATIC_UTILITIES.map(u => [u.id, u]))
const metas = new Map(MANIFEST.map(m => [m.id, m]))
const ctx: PresetCheckContext = {
  utility: id => byId.get(id),
  meta: id => metas.get(id),
  run: (input, steps, previews) => runPipeline(input, steps, { load: staticRegistry.load, previews, env: 'node' }),
  presetSlugs: new Set(STATIC_PRESETS.map(r => r.slug)),
}

describe('presets', () => {
  afterEach(() => { vi.useRealTimers() })

  it('ships every preset folder (run `npm run gen` after adding one)', () => {
    const folders = readdirSync(DIR, { withFileTypes: true })
      .filter(d => d.isDirectory() && !d.name.startsWith('_') && existsSync(path.join(DIR, d.name, 'preset.ts')))
      .map(d => d.name).sort()
    expect(STATIC_PRESETS.map(r => r.slug).sort()).toEqual(folders)
  })

  for (const preset of STATIC_PRESETS) {
    it(`${preset.slug} passes every preset rule`, async () => {
      expect(await checkPreset(preset, preset.slug, readGuide(preset.slug), ctx)).toEqual([])
    }, 30000)

    it(`${preset.slug} gives the same output whatever the date`, async () => {
      // a worked example that drifts with the clock ("2 years ago") would fail the build months later
      vi.useFakeTimers({ toFake: ['Date'] })
      const steps = toPipelineSteps(preset.steps)
      for (const now of ['2020-01-01T00:00:00Z', '2035-06-15T12:00:00Z']) {
        vi.setSystemTime(new Date(now))
        for (const sample of preset.samples) {
          const result = await runPipeline(sample.input, steps, { load: staticRegistry.load, env: 'node' })
          expect(formatForDisplay(result.out), `${sample.id} at ${now}`).toBe(sample.output)
        }
      }
    })
  }

  it('pass the rules across presets and utility guides (unique titles and queries, no near-copied prose)', () => {
    const utilityGuides = MANIFEST.flatMap(m => {
      const file = path.join(process.cwd(), 'src', 'utilities', m.id, 'guide.md')
      return existsSync(file) ? [{ id: m.id, source: readFileSync(file, 'utf8') }] : []
    })
    expect(checkPresetSet(STATIC_PRESETS.map(preset => ({ preset, guide: readGuide(preset.slug) })), utilityGuides)).toEqual([])
  })
})
