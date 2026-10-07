import { each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import type { PipelineStep } from '/home/user/string-utility-belt/src/types/utility'

// keep only the color value of a line: a hex or a CSS color function; a bare named color passes unchanged
const VALUE = '^.*?(#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\([^()]*\\)).*$'
const against = (id: string, background: string, prefix: string): PipelineStep[] => [
  laneStep(`${id}-value`, 'replace', { pattern: VALUE, replacement: '$1', regex: true, flags: 'i' }, { label: 'keep the color value' }),
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
      'Measures every color twice, once against #ffffff and once against #000000, and prints both verdicts under it. Token names such as $blue or green: are ignored, so only the color value is measured.',
      { label: 'check every color' }),
  ],
  samples: [
    { id: 'scss-variables', title: 'SCSS variables', input: '$blue:    #0d6efd !default;\n$red:     #dc3545 !default;\n$gray-600: #6c757d !default;\n$yellow:  #ffc107 !default;\n', output: "$blue:    #0d6efd !default;\n  on white: 4.5:1 — passes AA for normal text and AAA for large text\n  on black: 4.67:1 — passes AA for normal text and AAA for large text\n$red:     #dc3545 !default;\n  on white: 4.53:1 — passes AA for normal text and AAA for large text\n  on black: 4.64:1 — passes AA for normal text and AAA for large text\n$gray-600: #6c757d !default;\n  on white: 4.69:1 — passes AA for normal text and AAA for large text\n  on black: 4.48:1 — passes AA for large text and UI only\n$yellow:  #ffc107 !default;\n  on white: 1.63:1 — fails every WCAG minimum\n  on black: 12.88:1 — passes AAA for normal and large text\n" },
    { id: 'tailwind-v4-theme', title: 'Tailwind v4 @theme (oklch)', input: '--color-blue-500: oklch(0.623 0.214 259.815);\n--color-red-600: oklch(0.577 0.245 27.325);\n--color-green-700: oklch(0.527 0.154 150.069);\n', output: "--color-blue-500: oklch(0.623 0.214 259.815);\n  on white: 3.76:1 — passes AA for large text and UI only\n  on black: 5.58:1 — passes AA for normal text and AAA for large text\n--color-red-600: oklch(0.577 0.245 27.325);\n  on white: 4.76:1 — passes AA for normal text and AAA for large text\n  on black: 4.41:1 — passes AA for large text and UI only\n--color-green-700: oklch(0.527 0.154 150.069);\n  on white: 4.94:1 — passes AA for normal text and AAA for large text\n  on black: 4.25:1 — passes AA for large text and UI only\n" },
    { id: 'css-functions', title: 'Named, hsl() and translucent colors', input: 'rebeccapurple\nhsl(210 100% 40%)\nrgb(0 0 0 / 50%)\n', output: "rebeccapurple\n  on white: 8.41:1 — passes AAA for normal and large text\n  on black: 2.5:1 — fails every WCAG minimum\nhsl(210 100% 40%)\n  on white: 5.57:1 — passes AA for normal text and AAA for large text\n  on black: 3.77:1 — passes AA for large text and UI only\nrgb(0 0 0 / 50%)\n  on white: 3.98:1 — passes AA for large text and UI only\n  on black: 1:1 — fails every WCAG minimum\n" },
  ],
}
