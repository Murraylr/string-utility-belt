/**
 * The preset routes, and their preload: `main.tsx` waits for a preset page's code
 * and data (briefly) before React mounts, so the first render replaces the
 * pre-rendered HTML with the same page rather than a loading state.
 */
import type { Route } from '@/lib/router'
import { preloadable } from '@/app/preloadable'

export const PresetPage = preloadable(() => import('./PresetPage'))
export const PresetsIndexPage = preloadable(() => import('./PresetsIndexPage'))

/** Starts loading what `route` renders; resolves when it is ready (or right away for other routes). */
export function preloadPresetRoute(route: Route): Promise<unknown> {
  if (route.name === 'presets') return PresetsIndexPage.preload()
  if (route.name === 'preset') {
    return Promise.all([
      PresetPage.preload(),
      import('./presetData').then(m => m.loadPresetData(route.params.slug)),
    ])
  }
  return Promise.resolve()
}
