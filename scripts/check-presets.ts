/**
 * Checks presets (`src/presets/<slug>/`) against the rules in
 * `src/presets/check.ts` — the same checks `presets.test.ts` runs, with the
 * engine the SEO build uses (the static registry, in Node):
 *
 *   npm run check:presets -- decode-saml-request     (no slugs: every preset, plus the cross-preset rules)
 *
 * Reads each `preset.ts` directly, so it works before `npm run gen`. A sample
 * whose output differs prints the actual output next to the expected one.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { runPipeline } from '../src/core/runner'
import { staticRegistry, STATIC_UTILITIES } from '../src/utilities/static-registry'
import { MANIFEST } from '../src/utilities/_generated/manifest'
import { checkPreset, checkPresetSet, type PresetCheckContext } from '../src/presets/check'
import type { Preset } from '../src/presets/types'
import { discoverPresets, loadPreset, readPresetGuide } from './gen-presets'

async function main() {
  const asked = process.argv.slice(2).filter(a => a !== '--')
  const all = discoverPresets()
  const unknown = asked.filter(slug => !all.includes(slug))
  if (unknown.length) {
    console.error(`[check-presets] no preset folder for: ${unknown.join(', ')} (expected src/presets/<slug>/preset.ts)`)
    process.exit(2)
  }
  const targets = asked.length ? asked : all
  const byId = new Map(STATIC_UTILITIES.map(u => [u.id, u]))
  const metas = new Map(MANIFEST.map(m => [m.id, m]))
  const ctx: PresetCheckContext = {
    utility: id => byId.get(id),
    meta: id => metas.get(id),
    run: (input, steps, previews) => runPipeline(input, steps, { load: staticRegistry.load, previews, env: 'node' }),
    presetSlugs: new Set(all),
  }

  let failed = 0
  const loaded: Array<{ preset: Preset; guide: string | null }> = []
  for (const slug of targets) {
    const preset = await loadPreset(slug)
    const guide = readPresetGuide(slug)
    const problems = preset ? await checkPreset(preset, slug, guide, ctx) : ['preset.ts has no default export']
    if (preset) loaded.push({ preset, guide })
    if (problems.length === 0) console.log(`✓ ${slug}`)
    else { failed++; console.log(`✗ ${slug}\n${problems.map(p => `  - ${p}`).join('\n')}`) }
  }

  if (!asked.length) {
    const utilityGuides = MANIFEST.flatMap(m => {
      const file = path.join(process.cwd(), 'src', 'utilities', m.id, 'guide.md')
      return existsSync(file) ? [{ id: m.id, source: readFileSync(file, 'utf8') }] : []
    })
    const problems = checkPresetSet(loaded, utilityGuides)
    if (problems.length) { failed++; console.log(`✗ across presets\n${problems.map(p => `  - ${p}`).join('\n')}`) }
    else console.log('✓ across presets')
  }
  console.log(`\n${targets.length - Math.min(failed, targets.length)}/${targets.length} presets pass`)
  if (failed) process.exit(1)
}

main().catch(e => {
  console.error(`[check-presets] ${e?.stack ?? e}`)
  process.exit(1)
})
