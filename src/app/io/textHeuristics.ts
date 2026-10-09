/** Cheap, false-positive-averse content sniffing shared by download naming and output highlighting. */

export function parsesAsJson(text: string): boolean {
  const t = text.trim()
  if (t === '') return false
  // cheap gate before paying for JSON.parse on arbitrary text
  if (!/^[[{"\-\d]|^(true|false|null)\b/.test(t)) return false
  try {
    JSON.parse(t)
    return true
  } catch {
    return false
  }
}

export function looksLikeXmlDeclaration(text: string): boolean {
  return /^\s*<\?xml[\s\S]*?\?>/i.test(text)
}

export function looksLikeHtml(text: string): boolean {
  // anchored at the start (after comments): markdown that merely mentions <html> is not html
  // a comment's body never spans a `-->`, or a run of comments backtracks exponentially
  return /^\s*(?:<!--(?:(?!-->)[\s\S])*-->\s*)*<(!DOCTYPE\s+html|html[\s>])/i.test(text)
}

export function looksLikeXml(text: string): boolean {
  const t = text.trim()
  if (t === '') return false
  if (looksLikeXmlDeclaration(t)) return true
  // a single self-closing root, or a root element closed by its matching end tag
  return /^<[A-Za-z_][\w.:-]*(\s[^>]*)?\/>$/.test(t) || /^<([A-Za-z_][\w.:-]*)(\s[^>]*)?>[\s\S]*<\/\1\s*>$/.test(t)
}

export function looksLikeSql(text: string): boolean {
  return /^\s*(SELECT|INSERT\s+INTO|UPDATE\s+\w|DELETE\s+FROM|CREATE\s+(TABLE|INDEX|VIEW)|ALTER\s+TABLE|DROP\s+TABLE|WITH\s+\w+\s+AS)\b/i.test(text)
}

export function looksLikeCsv(text: string): boolean {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0)
  if (lines.length < 2) return false
  const counts = lines.map(l => (l.match(/,/g) || []).length)
  if (counts[0] === 0) return false
  return counts.every(c => c === counts[0])
}

export function looksLikeMarkdown(text: string): boolean {
  return /^#{1,6}\s/m.test(text) || /```/.test(text)
}

export function looksLikeYaml(text: string): boolean {
  // a document-start marker only counts as the first line: mid-text, --- is a markdown rule
  if (/^\s*---[ \t]*\r?\n/.test(text)) return true
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '')
  if (lines.length < 2) return false
  const keyLines = lines.filter(l => /^[ \t]*[\w.-]+:( |$)/.test(l) || /^[ \t]*-\s/.test(l))
  return keyLines.length / lines.length > 0.6
}
