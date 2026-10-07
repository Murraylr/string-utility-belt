import { proto, run } from '../harness'
import { each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/bulk-utm-link-builder/recipe'

const [extract, , dedupe, slot, fill] = ORIGINAL.steps

export const STRIP_EACH = each('strip', { mode: 'lines' }, [
  laneStep('amp', 'unescape_html', {}, { label: 'turn &amp; back into &' }),
  laneStep('drop-utm', 'query_params_normalize', {
    sort: false, dedupe: 'none', dropEmpty: false, drop: 'utm_*', decode: false, lowercaseHost: false,
  }, { label: 'drop utm_* parameters' }),
],
'Cleans one link at a time: turns the &amp; of HTML source back into &, then drops every query parameter matching utm_*, in any capitalization, with the ? or & it leaves behind. Add fbclid or gclid to the drop list to strip those too. Otherwise a reused link carries two utm_source values.',
{ label: 'remove old utm_ tags' })

export const UTM: Recipe = {
  ...ORIGINAL,
  updated: '2026-10-08',
  steps: [extract, STRIP_EACH, dedupe, slot, fill],
}

if (!(globalThis as any).__LIB) {
  const problems = await proto(UTM)
  for (const s of ORIGINAL.samples) {
    const r = await run(s.input, toPipelineSteps(UTM.steps))
    console.log(s.id, r.out === s.output ? 'SAME as main' : 'DIFFERENT')
  }
  console.log('problems:', problems)
}
