/**
 * Presets: hand-picked multi-step pipelines for one real task ("decode a SAML
 * request"), each published as a pre-rendered page at `/presets/<slug>/`.
 *
 * A preset lives in `src/presets/<slug>/`: `preset.ts` (default export, type
 * `Preset`: the steps, why each is there, and worked samples with golden
 * outputs) and `guide.md` (the page's search title/description frontmatter and
 * its prose). `npm run gen` writes `_generated/` from them; the rules every
 * preset must pass are in `check.ts`.
 */
import type { BranchStep, EachStep, MacroStep, PipelineStep, UtilityStep } from '../types/utility'

/** Hub sections, in display order. */
export const PRESET_CATEGORIES = [
  'Web & APIs',
  'DevOps & Config',
  'Data & Spreadsheets',
  'Writing & Marketing',
  'Frontend',
] as const
export type PresetCategory = (typeof PRESET_CATEGORIES)[number]

/** The reason a top-level step is in the preset, shown beside its output on the page. */
interface Why { why: string }

/** A top-level step: any pipeline step plus its reason. Steps inside a branch, macro or each carry no reason. */
export type PresetStep = (UtilityStep & Why) | (BranchStep & Why) | (MacroStep & Why) | (EachStep & Why)

/** One worked input. The first sample is the one the page opens with. */
export interface PresetSample {
  /** Unique within the preset, kebab-case (`redirect-url`). */
  id: string
  /** Its tab label on the page (`Redirect binding URL`). */
  title: string
  input: string
  /** The exact output, as `formatForDisplay` renders it; checked by the preset tests and the build. */
  output: string
}

export interface Preset {
  /** URL slug, equal to the folder name: lowercase words joined by single hyphens. */
  slug: string
  /** The page's H1 and card title, task-phrased: "Decode a SAML request". */
  name: string
  /** One or two sentences under the H1 and on cards. */
  summary: string
  category: PresetCategory
  /**
   * The search this page is written for. It must not be the head term of a utility
   * page (a utility guide title containing it), or the two pages would compete.
   */
  primaryQuery: string
  /** `YYYY-MM-DD`. */
  published: string
  /** `YYYY-MM-DD` of the last substantial revision. */
  updated?: string
  steps: PresetStep[]
  samples: PresetSample[]
  /** Other presets worth linking from this one, by slug. */
  related?: string[]
}

/** What `_generated/index.ts` keeps of each preset: enough for cards and links, no samples or steps. */
export interface PresetMeta {
  slug: string
  name: string
  summary: string
  category: PresetCategory
  /** Every utility the preset uses, nested branch steps included. */
  utilityIds: string[]
  /** The top-level steps' labels (else their utilities' display names), in order. */
  chain: string[]
  /** Top-level steps: the numbered steps on the page (a branch counts once). */
  stepCount: number
  published: string
  updated?: string
}

/** The steps as the engine, share links and the library take them: reasons dropped, `enabled` explicit. */
export function toPipelineSteps(steps: PresetStep[]): PipelineStep[] {
  return steps.map(s => {
    const step: Record<string, unknown> = { ...s, enabled: s.enabled !== false }
    delete step.why
    return step as unknown as PipelineStep
  })
}

/** A preset page's path. */
export const presetPath = (slug: string): string => `/presets/${encodeURIComponent(slug)}/`

export const PRESETS_PATH = '/presets/'
