/**
 * The app's view of the utility registry (lazy: code loads per utility on demand).
 * Components import from here — never from `@/utilities` (the eager test registry).
 */
export { registry, loadExamples } from '@/utilities/lazy'
export type { UtilityMeta } from '@/core/registry'
