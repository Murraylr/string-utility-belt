import { afterEach, describe, expect, it, vi } from 'vitest'
import { runPipeline, UTIL_MAP } from '@/utilities'
import { formatForDisplay } from '@/core/coerce'
import { validateParams } from '@/core/params'
import { isUtilityStep, walkSteps } from '@/core/steps'
import { sanitizeSteps } from '@/core/serialize'
import type { PipelineStep, UtilityStep } from '@/types/utility'
import { PRESETS } from './presets'

// "unix timestamp to dates" renders a `relative` field ("2 years ago") computed
// against Date.now(). Its golden output was captured against a fixed instant, so
// the clock is pinned to that instant here — otherwise the assertion would drift
// out of date and start failing on its own a few months from now.
const FIXED_NOW = new Date('2026-09-23T12:00:00.000Z')

const utilitySteps = (steps: PipelineStep[]): UtilityStep[] => {
  const out: UtilityStep[] = []
  walkSteps(steps, s => { if (isUtilityStep(s)) out.push(s) })
  return out
}

/** Generators ship crypto-random (seed 0); pin a seed to compare against the golden output. */
const seeded = (steps: PipelineStep[]): PipelineStep[] => JSON.parse(JSON.stringify(steps), (key, value) =>
  key === 'seed' && value === 0 ? 42 : value)

describe('presets', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('ships at least 14 presets, each with a unique id and name', () => {
    expect(PRESETS.length).toBeGreaterThanOrEqual(14)
    expect(new Set(PRESETS.map(p => p.id)).size).toBe(PRESETS.length)
    expect(new Set(PRESETS.map(p => p.name)).size).toBe(PRESETS.length)
  })

  it('covers every preset the roadmap asks for', () => {
    const names = PRESETS.map(p => p.name)
    for (const wanted of [
      'Decode a JWT', 'Fix mojibake', 'CSV to JSON', 'Double URL-decode', 'Strong password',
      'Base64 → gunzip → pretty JSON', 'Slugify every line', 'Extract unique emails', 'SQL IN-list builder',
      'Hash three ways', 'Clean text pasted from Word', 'Hex dump', 'JSON to YAML', 'Unix timestamp to dates',
    ]) expect(names).toContain(wanted)
  })

  for (const preset of PRESETS) {
    describe(preset.name, () => {
      it('uses only real utilities, real param names and valid param values', () => {
        for (const step of utilitySteps(preset.steps)) {
          const util = UTIL_MAP[step.utilityId]
          expect(util, `unknown utility ${step.utilityId}`).toBeDefined()
          const known = Object.keys(util.params ?? {})
          for (const key of Object.keys(step.params ?? {})) {
            expect(known, `${step.utilityId} has no param "${key}"`).toContain(key)
          }
          expect(validateParams(util, step.params ?? {}), `${step.utilityId} params`).toEqual({})
        }
      })

      it('survives the share/library sanitiser unchanged', () => {
        expect(sanitizeSteps(preset.steps)).toEqual(preset.steps)
      })

      it('runs its sample input with no step errors and matches its golden output', async () => {
        if (preset.id === 'unix-timestamp-to-dates') {
          vi.useFakeTimers({ toFake: ['Date'] })
          vi.setSystemTime(FIXED_NOW)
        }
        const result = await runPipeline(preset.sampleInput, seeded(preset.steps), false)
        expect(result.err).toEqual({})
        expect(result.halted).toBe(false)
        expect(formatForDisplay(result.out)).toBe(preset.expectedOutput)
      })
    })
  }

  it('"Strong password" is genuinely random (never the same password for everyone)', async () => {
    const preset = PRESETS.find(p => p.id === 'strong-password')!
    const a = formatForDisplay((await runPipeline(preset.sampleInput, preset.steps, false)).out)
    const b = formatForDisplay((await runPipeline(preset.sampleInput, preset.steps, false)).out)
    expect(a).not.toBe(b)
    for (const pw of [a, b]) {
      expect(pw).toHaveLength(20)
      expect(pw).toMatch(/[A-Z]/)
      expect(pw).toMatch(/[a-z]/)
      expect(pw).toMatch(/[0-9]/)
      expect(pw).toMatch(/[^A-Za-z0-9]/)
    }
  })

  it('"Slugify every line" slugs each line independently', async () => {
    const preset = PRESETS.find(p => p.id === 'slugify-lines')!
    const out = formatForDisplay((await runPipeline('Hello World\n\nÀ bientôt!', preset.steps, false)).out)
    expect(out).toBe('hello-world\n\na-bientot')
  })
})
