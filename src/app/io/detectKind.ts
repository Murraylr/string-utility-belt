import { valueType } from '@/core/coerce'
import type { Value } from '@/types/utility'
import {
  looksLikeCsv, looksLikeHtml, looksLikeMarkdown, looksLikeSql, looksLikeXml, looksLikeYaml, parsesAsJson,
} from './textHeuristics'

export type OutputKind = 'json' | 'xml' | 'html' | 'yaml' | 'sql' | 'csv' | 'markdown' | 'text'

/** Best-effort guess at what a string/json output "is", to pick a CodeMirror language. */
export function detectKind(value: Value, text: string): OutputKind {
  if (valueType(value) === 'json') return 'json'
  if (parsesAsJson(text)) return 'json'
  if (looksLikeHtml(text)) return 'html'
  if (looksLikeXml(text)) return 'xml'
  if (looksLikeSql(text)) return 'sql'
  if (looksLikeCsv(text)) return 'csv'
  if (looksLikeYaml(text)) return 'yaml'
  if (looksLikeMarkdown(text)) return 'markdown'
  return 'text'
}
