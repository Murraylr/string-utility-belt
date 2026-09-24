/**
 * The browser's utility registry: metadata ships up front (generated manifest),
 * each utility's code is a separate chunk fetched the first time a step uses it.
 */
import { createRegistry } from '../core/registry'
import { MANIFEST } from './_generated/manifest'
import { LOADERS } from './_generated/loaders'

export const registry = createRegistry(MANIFEST, async id => {
  const load = LOADERS[id]
  if (!load) throw new Error(`unknown utility: ${id}`)
  return (await load()).default
})

/** Worked examples are only needed by doc pages, so they are their own chunk. */
export const loadExamples = () => import('./_generated/examples').then(m => m.EXAMPLES)
