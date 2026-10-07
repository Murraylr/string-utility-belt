import { run } from '../harness'
import { each, laneStep, branch } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps, type Recipe, type RecipeStep } from '/home/user/string-utility-belt/src/recipes/types'
import PDF from '/home/user/string-utility-belt/src/recipes/fix-pdf-line-breaks/recipe'
import GPT from '/home/user/string-utility-belt/src/recipes/clean-chatgpt-text/recipe'
import SPRING from '/home/user/string-utility-belt/src/recipes/spring-boot-yaml-to-env-vars/recipe'

async function compare(name: string, main: Recipe, steps: RecipeStep[]) {
  const s = toPipelineSteps(steps)
  for (const sample of main.samples) {
    const r = await run(sample.input, s)
    const ok = r.out === sample.output
    console.log(`${name} / ${sample.id}: ${ok ? 'same' : 'DIFFERS'}${Object.keys(r.errors).length ? ' errors ' + JSON.stringify(r.errors) : ''}`)
    if (!ok) console.log('   main ', JSON.stringify(sample.output).slice(0, 300), '\n   each ', JSON.stringify(r.out).slice(0, 300))
  }
}

// (a) fix-pdf-line-breaks: page numbers blanked per line instead of deleted by sed
const footersEach = each('footers', { mode: 'lines' }, [
  laneStep('num', 'replace', { pattern: '^\\s*[-–—]?\\s*\\d{1,4}\\s*[-–—]?\\s*$', replacement: '', regex: true, flags: '' }),
  laneStep('page', 'replace', { pattern: '^\\s*page\\s+\\d+(\\s+of\\s+\\d+)?\\s*$', replacement: '', regex: true, flags: 'i' }),
], 'Blanks every line that is only a page number.')
await compare('pdf footers as each', PDF, PDF.steps.map(s => s.id === 'footers' ? footersEach : s))

// (b) clean-chatgpt-text: the per-line sed inside a lines each
await compare('chatgpt lists in each', GPT, GPT.steps.map(s => s.id === 'lists'
  ? each('lists', { mode: 'lines' }, [laneStep('sed', 'sed', (s as any).params)], 'Same sed, one line at a time.', { includeEmpty: true }) : s))

// (e) spring-boot: the Kubernetes lane without the sed regex
const k8s = branch('formats', [
  (SPRING.steps[3] as any).branches[0],
  [
    laneStep('k8s-env', 'json_to_env', { upperCase: true, delimiter: '_', quote: 'always', exportPrefix: false }),
    each('k8s-item', { mode: 'lines' }, [
      laneStep('value', 'replace', { pattern: '=', replacement: '\n    value: ', regex: true, flags: '' }),
      laneStep('name', 'insert_at', { text: '  - name: ', position: 0, mode: 'insert', perLine: false }),
    ], 'x x x x x x') as any,
    laneStep('k8s-heading', 'insert_at', { text: 'env:\\n', position: 0, mode: 'insert', perLine: false }),
  ],
], { mode: 'concat', separator: '\n\n' }, 'x x x x x x')
await compare('spring k8s lane as each', SPRING, SPRING.steps.map(s => s.id === 'formats' ? k8s : s))
