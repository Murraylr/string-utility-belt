/**
 * Preset pages' data in the browser: the preset and its rendered guide, one lazy
 * chunk per preset (`_generated/loaders.ts`). Loads are cached, and a finished
 * one is readable synchronously (`peekPresetData`), so a page whose data was
 * preloaded before React mounted (see `routes.ts`) renders complete on its
 * first pass instead of flashing a loading state over the pre-rendered HTML.
 */
import { PRESET_LOADERS } from '@/presets/_generated/loaders'
import type { Preset } from '@/presets/types'
import { parseGuide, renderMarkdownDocument } from '../guide'

export interface PresetData {
  preset: Preset
  /** The guide's search title and description (the pre-rendered page's `<head>` has the same). */
  title: string
  description: string
  /** The guide body as trusted HTML (everything escaped by `renderMarkdownDocument`). */
  guideHtml: string
}

const pending = new Map<string, Promise<PresetData | null>>()
const settled = new Map<string, PresetData | null>()

/** The preset with this slug, or null when there is none. Rejects when its chunk fails to load. */
export function loadPresetData(slug: string): Promise<PresetData | null> {
  let load = pending.get(slug)
  if (!load) {
    // own keys only: a slug such as "constructor" must not reach Object.prototype
    load = !Object.prototype.hasOwnProperty.call(PRESET_LOADERS, slug)
      ? Promise.resolve(null)
      : PRESET_LOADERS[slug]().then(({ preset, guide }) => {
        const parsed = parseGuide(guide)
        return {
          preset,
          title: parsed.title ?? preset.name,
          description: parsed.description ?? preset.summary,
          guideHtml: renderMarkdownDocument(guide),
        }
      })
    pending.set(slug, load)
    load.then(
      data => { settled.set(slug, data) },
      // a failed chunk load (offline, a deploy replaced the chunk) may be retried
      () => { pending.delete(slug) },
    )
  }
  return load
}

/** A finished load: the data, null for no such preset, undefined while not loaded (or failed). */
export const peekPresetData = (slug: string): PresetData | null | undefined => settled.get(slug)
