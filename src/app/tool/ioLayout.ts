import { usePref } from '@/app/prefs'

/** Where the output sits: beside the input and steps ('side-by-side'), or below them ('stacked'). */
export type IOLayout = 'stacked' | 'side-by-side'

/** The tool page's layout preference, shared by the page frame and the output panel's toggle. */
export const useIOLayout = () => usePref<IOLayout>('ioLayout', 'side-by-side')

/** Whether the output panel shows the result or its diff against the input. */
export const useOutputDiff = () => usePref('ioDiff', false)
