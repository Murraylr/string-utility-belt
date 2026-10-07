import { run } from '../harness'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import { toPipelineSteps } from '/home/user/string-utility-belt/src/recipes/types'
const P = (s: any[]) => toPipelineSteps(s)
const show = (label: string, r: any) => console.log(label, JSON.stringify(r.out), JSON.stringify(r.errors))
const jsonl = '{"messages":[{"role":"user","content":"hi"}]}\n{"messages":[{"role":"user","content":"a"},]}\n\n{"messages": [{"role":"user" "content":"b"}]}\n{"ok":true}\n'
// existing single utility: first error only
show('jsonl_to_json:', await run(jsonl, P([step('a', 'jsonl_to_json', {}, 'x')])))
// candidate: every bad line with its number
show('bad-lines:', await run(jsonl, P([
  each('v', { mode: 'lines' }, [laneStep('val', 'json_validate', { strict: true }), laneStep('err', 'jsonpath', { path: '$.error', mode: 'first', indent: 0 })], 'x'),
  step('n', 'number_lines', { start: 1, separator: ': ' }, 'x'),
  step('g', 'grep_lines', { pattern: '^\\d+: .', regex: true }, 'x'),
])))
// list to JSON array
show('list->json:', await run('apple\nsay "hi"\nC:\\temp\n\n42\n', P([each('q', { mode: 'lines' }, [laneStep('e', 'code_string_escape', { language: 'json', wrap: true })], 'x'), step('a', 'jsonl_to_json', {}, 'x')])))
// md5 per line (overlaps SHA-256 Customer Match group)
show('md5 each:', await run(' Ada@Example.com\nbob@example.org\n', P([step('t', 'trim_lines', {}, 'x'), step('l', 'case', { mode: 'lower' }, 'x'), each('h', { mode: 'lines' }, [laneStep('m', 'md5')], 'x')])))
show('md5 whole:', await run('ada@example.com\nbob@example.org\n', P([step('m', 'md5', {}, 'x')])))
// base64 per line
show('b64 whole:', await run('aGVsbG8=\nd29ybGQ=\n', P([step('b', 'base64_decode', {}, 'x')])))
show('b64 each:', await run('aGVsbG8=\nd29ybGQ=\n', P([each('b', { mode: 'lines' }, [laneStep('d', 'base64_decode')], 'x')])))
// format_case per line
show('format_case whole:', await run('first name\nlast name\n', P([step('f', 'format_case', { mode: 'snake' }, 'x')])))
// language detect per line
show('lang each:', await run('Great product, fast shipping\nProducto excelente, envío rápido\nTrès bon produit\nSehr gutes Produkt\n', P([each('l', { mode: 'lines' }, [laneStep('d', 'language_detect')], 'x')])))
