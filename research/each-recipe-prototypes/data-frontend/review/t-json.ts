import { run } from '../../harness'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { recipe } from '../list-to-json-array'
const S = toPipelineSteps(recipe.steps)
const ALT = toPipelineSteps([
  each('e', { mode: 'lines' }, [laneStep('t', 'trim'), laneStep('q', 'code_string_escape', { language: 'json', quote: 'double', wrap: true, escapeNonAscii: false }, { condition: { kind: 'nonEmpty' } })], 'x x x x x x'),
  step('arr', 'jsonl_to_json', { indent: 2, skipBlank: true, onError: 'error' }, 'x x x x x x'),
])
// what does no-each look like?
const NOEACH = toPipelineSteps([
  step('q', 'line_affix', { prefix: '"', suffix: '"', skipBlank: true, joinWith: ', ' }, 'x x x x x x'),
  step('w', 'line_affix', { prefix: '[', suffix: ']', skipBlank: true, joinWith: '' }, 'x x x x x x'),
  step('p', 'json_pretty', { indent: 2 }, 'x x x x x x'),
])
const cases: Record<string, string> = {
  s1: recipe.samples[0].input, s2: recipe.samples[1].input,
  empty: '', single: 'Home', onlyBlank: '\n\n',
  ctrl: 'a\u0001b\nc\u0007d\n', ls: 'a b\n',
  unicode: '東京\n😀 emoji\n', 
  commaList: 'apple, banana, cherry\n',
  numbers: '101\n007\n3.14\ntrue\nnull\n',
  csvQuoted: '"Home"\n"About us"\n',
  tsv: 'Home\t/\nAbout\t/about\n',
  bullets: '- Home\n- About\n* Contact\n1. Blog\n',
  htmlEsc: 'Tom &amp; Jerry\n',
  bigList: Array.from({ length: 20000 }, (_, i) => `item ${i}`).join('\n'),
  lone: 'a\ud800b\n',
}
for (const [k, v] of Object.entries(cases)) {
  const t0 = Date.now()
  const r = await run(v, S); const t1 = Date.now(); const a = await run(v, ALT); const n = await run(v, NOEACH)
  const show = (x: any) => JSON.stringify(String(x).slice(0, 160))
  console.log(`--- ${k}: ${show(v)} (${t1 - t0}ms)\n  draft: ${show(r.out)} ${Object.keys(r.errors).length ? JSON.stringify(r.errors).slice(0, 200) : ''}\n  alt  : ${show(a.out)} ${Object.keys(a.errors).length ? JSON.stringify(a.errors).slice(0, 200) : ''}\n  same : ${String(r.out) === String(a.out)}   noeach: ${show(n.out)} ${Object.keys(n.errors).length ? 'ERR' : ''}`)
}
