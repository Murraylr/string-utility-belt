import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { recipe } from '../check-palette-contrast'
const S = toPipelineSteps(recipe.steps)
const cases: Record<string, string> = {
  bootstrapScss: '$blue:    #0d6efd !default;\n$red:     #dc3545 !default;\n$gray-600: #6c757d !default;\n$white:    #fff !default;\n',
  tailwindCfg: "  primary: '#2b6cb0',\n  'blue-500': '#3b82f6',\n  green: '#2f855a',\n",
  cssVars: '--color-primary: #2b6cb0;\n--color-danger: #c53030;\n',
  tw4theme: '--color-blue-500: oklch(0.623 0.214 259.815);\n--color-red-600: oklch(0.577 0.245 27.325);\n',
  jsonTokens: '"brand": "#2b6cb0",\n"gold": "#ecc94b",\n',
  figma: 'Primary/500 #2B6CB0\nNeutral/Black #111111\n',
  hexNoHash: '2b6cb0\nc53030\n',
  comment: '/* brand */\n#2b6cb0\n',
}
for (const [k, v] of Object.entries(cases)) {
  const r = await run(v, S)
  console.log(`--- ${k}\n${r.out}${Object.keys(r.errors).length ? 'ERRORS ' + JSON.stringify(r.errors).slice(0, 300) : ''}`)
}
