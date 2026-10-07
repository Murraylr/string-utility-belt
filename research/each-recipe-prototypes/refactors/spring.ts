import { run } from '../harness'
import { each, laneStep } from '/home/user/string-utility-belt/src/recipes/define'

const u = (id: string, utilityId: string, params: Record<string, unknown> = {}) => ({ id, utilityId, enabled: true, params }) as any
const doc = '{"spring":{"jpa":{"hibernate":{"ddl-auto":"validate"}},"datasource":{"url":"jdbc:sqlserver://db.example.net:1433;databaseName=billing"}},"app":{"report-cron":"0 30 6 * * MON-FRI"}}'

// 1. what json_to_env does with a dash, and whether the dash survives any flattening an each could work on
console.log('json_to_env default        :', JSON.stringify((await run(doc, [u('e', 'json_to_env', { upperCase: true, delimiter: '_', quote: 'auto' })])).out))
console.log('json_to_env "." lowercase  :', JSON.stringify((await run(doc, [u('e', 'json_to_env', { upperCase: false, delimiter: '.', quote: 'auto' })])).out))
console.log('json_flatten               :', JSON.stringify((await run(doc, [u('f', 'json_flatten', { delimiter: '.', arrayNotation: 'dot', indent: 0 })])).out))

// 2. json-values each sees values only: keys (where the dashes are) come back untouched
const flat = (await run(doc, [u('f', 'json_flatten', { delimiter: '.', arrayNotation: 'dot', indent: 0 })])).out
const valuesEach = await run(flat, [each('v', { mode: 'json-values' }, [laneStep('r', 'replace', { pattern: '-', replacement: '', regex: false, flags: 'g' })], 'x x x x x x') as any])
console.log('each json-values on flat   :', valuesEach.out, '  <- keys keep dashes, values lose theirs (MON-FRI -> MONFRI)')

// 3. per line over KEY=value: a lane step cannot tell the key from the value without the same regex
const envLines = (await run(doc, [u('e', 'json_to_env', { upperCase: false, delimiter: '.', quote: 'auto' })])).out
const delimEach = await run(envLines, [each('l', { mode: 'lines' }, [
  each('kv', { mode: 'delimiter', separator: '=' }, [laneStep('r', 'replace', { pattern: '-', replacement: '', regex: false, flags: 'g' })], 'x x x x x x') as any,
], 'x x x x x x') as any])
console.log('each line, each "=" piece  :', JSON.stringify(delimEach.out), ' <- the value after = loses its dashes too')
