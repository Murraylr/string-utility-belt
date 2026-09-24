import type { Utility, Value } from '@/types/utility'
import { SANDBOX_TIMEOUT, clampSandboxTimeout, getSandbox, validateSandboxResult } from '@/core/sandbox'

/**
 * The default is a commented-out example: a freshly added step passes its input
 * through untouched, and nothing executes until the user writes code.
 */
const EXAMPLE = [
  '// `input` is the value from the previous step: a string, a Uint8Array',
  '// (bytes) or parsed JSON. Return the new value; `await` works here too.',
  '// Runs in an isolated sandbox with no network access.',
  '//',
  '// return String(input).toUpperCase()',
  '',
].join('\n')

const LINE_END = /[\n\r\u2028\u2029]/g

/** Only whitespace and comments: there is nothing to run. A linear scan (a regex here backtracks badly). */
export function isBlankCode(code: string): boolean {
  let i = 0
  while (i < code.length) {
    if (/\s/.test(code[i])) { i++; continue }
    if (code.startsWith('//', i)) {
      LINE_END.lastIndex = i
      if (!LINE_END.exec(code)) return true
      i = LINE_END.lastIndex
      continue
    }
    if (code.startsWith('/*', i)) {
      const end = code.indexOf('*/', i + 2)
      if (end < 0) return false
      i = end + 2
      continue
    }
    return false
  }
  return true
}

const util: Utility = {
  id: 'custom_js',
  name: 'custom javascript',
  category: 'String Ops',
  description:
    'Run your own JavaScript function body on the value, in an isolated sandbox with no network access ' +
    'and no access to the rest of the app. Steps from shared links or imports arrive disabled until you review them.',
  accepts: ['string', 'bytes', 'json'],
  produces: ['string', 'bytes', 'json'],
  env: ['eval', 'main'],
  tags: ['javascript', 'js', 'script', 'function', 'code', 'map', 'transform'],
  params: {
    code: {
      kind: 'code',
      language: 'javascript',
      label: 'code',
      default: EXAMPLE,
      description:
        'The body of a function: `input` holds the value (string, Uint8Array or JSON) and the body must ' +
        '`return` the result — a string, a Uint8Array, or a JSON object or array. Async code may use `await`.',
    },
    timeoutMs: {
      kind: 'number',
      label: 'timeout (ms)',
      default: SANDBOX_TIMEOUT.default,
      min: SANDBOX_TIMEOUT.min,
      max: SANDBOX_TIMEOUT.max,
      integer: true,
      description: 'The run is stopped after this long.',
    },
  },
  async apply(input, params, ctx) {
    const code = String(params.code ?? '')
    if (isBlankCode(code)) return input
    const sandbox = getSandbox()
    if (!sandbox) throw new Error('Custom JavaScript is not available here — it only runs in the web app.')
    const out: Value = await sandbox.run({
      code,
      input,
      timeoutMs: clampSandboxTimeout(params.timeoutMs),
      signal: ctx?.signal,
    })
    return validateSandboxResult(out)
  },
}
export default util
