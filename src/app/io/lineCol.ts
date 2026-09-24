/** Caret <-> line/column math for the input textarea. Columns count Unicode code points, not UTF-16 units. */

export interface LineCol {
  line: number
  col: number
}

export function computeLineCol(text: string, caretIndex: number): LineCol {
  const before = text.slice(0, Math.max(0, caretIndex))
  const lastNewline = before.lastIndexOf('\n')
  const line = countNewlines(before) + 1
  const colText = lastNewline === -1 ? before : before.slice(lastNewline + 1)
  const col = Array.from(colText).length + 1
  return { line, col }
}

function countNewlines(text: string): number {
  let n = 0
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return n
}

/** UTF-16 offset of the start of `lineNumber` (1-based), clamped to the text's line range. */
export function lineStartOffset(text: string, lineNumber: number): number {
  const lines = text.split('\n')
  const idx = Math.min(Math.max(lineNumber, 1), lines.length) - 1
  let offset = 0
  for (let i = 0; i < idx; i++) offset += lines[i].length + 1
  return offset
}

export function totalLines(text: string): number {
  return text === '' ? 1 : text.split('\n').length
}
