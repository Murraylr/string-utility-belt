import type { Recipe } from '/home/user/string-utility-belt/src/recipes/types'
import { each, laneStep, step } from '/home/user/string-utility-belt/src/recipes/define'
import DRAFT from '../decode-cloudwatch-logs-data.recipe'

/**
 * Variant C: the draft's per-payload design, but the gunzip is its own top-level step, so the
 * page's worked example still shows the decoded envelope (logGroup, logStream, logEvents).
 */
const recipe: Recipe = {
  ...DRAFT,
  steps: [
    DRAFT.steps[0],
    each('gunzip', { mode: 'lines' }, [laneStep('gunzip-one', 'gzip_decompress', { output: 'text' })],
      'Decodes the Base64 of each payload, inflates its gzip and checks the CRC-32. Each becomes the JSON envelope CloudWatch Logs built, on one line: messageType, owner, logGroup, logStream, subscriptionFilters and the logEvents array.',
      { label: 'unzip each payload' }),
    each('messages', { mode: 'lines' }, [
      laneStep('pick', 'jsonpath', { path: '$.logEvents[*].message', mode: 'values', indent: 2 }, { label: 'pick every message' }),
      laneStep('lines', 'json_to_jsonl', {}),
    ],
    'Keeps the message of every log event, in order, and drops the envelope and the event ids and timestamps. Each message is written as a JSON string on its own line, so a stack trace is still one line here.',
    { label: 'keep each message' }),
    DRAFT.steps[2],
  ],
}
export default recipe
