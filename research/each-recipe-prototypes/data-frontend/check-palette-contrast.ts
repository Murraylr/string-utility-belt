
import { each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import type { PipelineStep } from '/home/user/string-utility-belt/src/types/utility'

const against = (id: string, background: string, prefix: string): PipelineStep[] => [
  laneStep(`${id}-ratio`, 'color_contrast', { foreground: '', background }),
  laneStep(`${id}-verdict`, 'jsonpath', { path: '$.summary', mode: 'first', indent: 2 }),
  laneStep(`${id}-label`, 'line_affix', { prefix, suffix: '', skipBlank: true, joinWith: '' }),
]

export const recipe: Recipe = {
  slug: 'check-palette-contrast-on-white-and-black',
  name: 'Check a color palette against white and black text',
  summary:
    'Paste your palette, one color per line in any CSS format, and see each color’s WCAG contrast ratio with white and with black, with the AA and AAA levels it meets.',
  category: 'Frontend',
  primaryQuery: 'palette contrast checker',
  published: '2026-10-08',
  steps: [
    each('per-color', { mode: 'lines' }, [
      { id: 'pair', type: 'branch', enabled: true, label: 'color, on white, on black',
        branches: [[], against('white', '#ffffff', 'on white: '), against('black', '#000000', 'on black: ')],
        merge: { mode: 'concat', separator: '\n  ' } } as PipelineStep,
    ],
      'Measures every color twice, once against #ffffff and once against #000000, and prints both verdicts under it. The contrast utility compares a single pair, so a palette of ten colors would otherwise take twenty separate checks.',
      { label: 'check every color' }),
  ],
  samples: [
    { id: 'oklch-ramp', title: 'oklch() shade ramp', input: 'oklch(0.95 0.03 250)\noklch(0.82 0.08 250)\noklch(0.7 0.13 250)\noklch(0.6 0.16 250)\noklch(0.5 0.16 250)\noklch(0.38 0.12 250)\n', output: `oklch(0.95 0.03 250)
  on white: 1.16:1 — fails every WCAG minimum
  on black: 18.15:1 — passes AAA for normal and large text
oklch(0.82 0.08 250)
  on white: 1.74:1 — fails every WCAG minimum
  on black: 12.09:1 — passes AAA for normal and large text
oklch(0.7 0.13 250)
  on white: 2.66:1 — fails every WCAG minimum
  on black: 7.9:1 — passes AAA for normal and large text
oklch(0.6 0.16 250)
  on white: 3.95:1 — passes AA for large text and UI only
  on black: 5.32:1 — passes AA for normal text and AAA for large text
oklch(0.5 0.16 250)
  on white: 5.94:1 — passes AA for normal text and AAA for large text
  on black: 3.54:1 — passes AA for large text and UI only
oklch(0.38 0.12 250)
  on white: 9.94:1 — passes AAA for normal and large text
  on black: 2.11:1 — fails every WCAG minimum
` },
    { id: 'hex-palette', title: 'Hex palette', input: '#2b6cb0\n#c53030\n#2f855a\n#ecc94b\n#718096\n', output: `#2b6cb0
  on white: 5.42:1 — passes AA for normal text and AAA for large text
  on black: 3.87:1 — passes AA for large text and UI only
#c53030
  on white: 5.47:1 — passes AA for normal text and AAA for large text
  on black: 3.84:1 — passes AA for large text and UI only
#2f855a
  on white: 4.54:1 — passes AA for normal text and AAA for large text
  on black: 4.62:1 — passes AA for normal text and AAA for large text
#ecc94b
  on white: 1.61:1 — fails every WCAG minimum
  on black: 13.02:1 — passes AAA for normal and large text
#718096
  on white: 4.02:1 — passes AA for large text and UI only
  on black: 5.23:1 — passes AA for normal text and AAA for large text
` },
    { id: 'css-functions', title: 'Named, hsl() and translucent colors', input: 'rebeccapurple\nhsl(210 100% 40%)\nrgb(0 0 0 / 50%)\n', output: `rebeccapurple
  on white: 8.41:1 — passes AAA for normal and large text
  on black: 2.5:1 — fails every WCAG minimum
hsl(210 100% 40%)
  on white: 5.57:1 — passes AA for normal text and AAA for large text
  on black: 3.77:1 — passes AA for large text and UI only
rgb(0 0 0 / 50%)
  on white: 3.98:1 — passes AA for large text and UI only
  on black: 1:1 — fails every WCAG minimum
` },
  ],
}

