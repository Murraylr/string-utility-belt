import { proto, run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import ORIGINAL from '/home/user/string-utility-belt/src/recipes/decode-cloudwatch-logs-data/recipe'

const [data, gunzip, messages] = ORIGINAL.steps

/** Variant A: one JSON string per line, then decode each line on its own. */
const A: Recipe = {
  ...ORIGINAL,
  published: '2026-10-07',
  updated: '2026-10-08',
  steps: [
    data, gunzip, messages,
    step('lines', 'json_to_jsonl', {},
      'Writes each message as a JSON string on a line of its own. Line breaks inside a message stay escaped as \\n, so every real line break now separates two log events and the next step can take them one at a time.'),
    each('decode', { mode: 'lines' }, [
      laneStep('unescape', 'code_string_unescape', { language: 'json' }),
      laneStep('final-newline', 'normalize_line_endings', { mode: 'lf', finalNewline: 'remove' }, { label: "drop the message's final line break" }),
    ],
    "Decodes every line on its own: strips its quotes and turns \\t, \\\" and \\n back into a tab, a quote and a real line break, so stack traces and logged JSON read as written. Then it drops the message's own final line break, which would otherwise leave a blank line after it.",
    { label: 'decode each message' }),
  ],
}

const problems = await proto(A)

// identical golden outputs?
for (const s of ORIGINAL.samples) {
  const r = await run(s.input, toPipelineSteps(A.steps))
  console.log(s.id, r.out === s.output ? 'SAME as main' : 'DIFFERENT')
}
console.log('problems:', problems)
