/**
 * Per-utility throughput on a large (1 MB) input, for 15 utilities that cover
 * the common shapes of work in the belt: encoding, hashing, compression,
 * case/whitespace transforms and simple stats. Each fixture that needs a
 * *valid* encoded input (base64_decode, url_decode) is built once up front
 * with the matching encoder, so the benchmark measures the decoder alone.
 *
 * Params go through `resolveParams` (declared defaults filled in, as the
 * runner does) once, outside the timed body, so each bench measures the
 * configuration a real pipeline step would run with and nothing else.
 *
 * Every bench uses a short, fixed sampling window (`HEAVY`): this suite is
 * for spotting a regression, not for precise absolute numbers, and a full
 * tinybench run at 1 MB is minutes, not seconds, per utility.
 *
 * `npm run bench` (vitest bench --run) runs this file.
 */
import { bench, describe } from 'vitest'
import { loadEager, resolveParams } from '../src/utilities/index'
import type { Params, Value } from '../src/types/utility'

const ONE_MB = 'The quick brown fox jumps over the lazy dog. '.repeat(Math.ceil((1024 * 1024) / 46)).slice(0, 1024 * 1024)

/** A ready-to-time call: the utility and its resolved params are looked up once. Unknown
 * param names throw here, so a typo cannot silently bench the default configuration. */
function prepare(id: string, params: Params = {}): (input: Value) => Promise<unknown> {
  const util = loadEager(id)
  for (const key of Object.keys(params)) {
    if (!(key in (util.params ?? {}))) throw new Error(`bench: ${id} has no param "${key}"`)
  }
  const resolved = resolveParams(util, params)
  return async (input) => util.apply(input as never, resolved as never)
}

const base64Fixture = (await prepare('base64_encode')(ONE_MB)) as string
const urlFixture = (await prepare('url_encode')(ONE_MB)) as string

const HEAVY = { time: 200, iterations: 5, warmupIterations: 1, warmupTime: 50 }

const CASES: [name: string, id: string, input: Value, params?: Params][] = [
  ['base64_encode', 'base64_encode', ONE_MB],
  ['base64_decode', 'base64_decode', base64Fixture],
  ['hex_encode', 'hex_encode', ONE_MB],
  ['url_encode', 'url_encode', ONE_MB],
  ['url_decode', 'url_decode', urlFixture],
  ['reverse', 'reverse', ONE_MB],
  ['rot13', 'rot13', ONE_MB],
  ['swap_case', 'swap_case', ONE_MB],
  ['case (upper)', 'case', ONE_MB, { mode: 'upper' }],
  ['trim', 'trim', ONE_MB],
  ['collapse_whitespace', 'collapse_whitespace', ONE_MB],
  ['count', 'count', ONE_MB],
  ['json_escape', 'json_escape', ONE_MB],
  ['gzip_compress (level 6)', 'gzip_compress', ONE_MB, { level: 6 }],
  ['hash (SHA-256)', 'hash', ONE_MB, { algo: 'SHA-256' }]
]

describe('utilities: 1 MB input', () => {
  for (const [name, id, input, params] of CASES) {
    const run = prepare(id, params)
    bench(name, async () => { await run(input) }, HEAVY)
  }
})
