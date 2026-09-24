/** One `## [version] - date` section of a Keep a Changelog document. */
export interface ChangelogRelease {
  version: string
  date?: string
  /** Raw markdown body of the section (everything after the heading line, before the next `## `). */
  bodyMd: string
}

const RELEASE_HEADING = /^##\s*\[([^\]]+)\]\s*(?:-\s*(\d{4}-\d{2}-\d{2}))?\s*$/

/**
 * Splits a Keep a Changelog (`https://keepachangelog.com`) document into its
 * `## [version] - date` releases, newest-first (as written). Ignores the `# `
 * title and any preamble before the first release heading.
 */
export function parseChangelog(md: string): ChangelogRelease[] {
  const lines = String(md).replace(/\r\n?/g, '\n').split('\n')
  const releases: ChangelogRelease[] = []
  let current: Omit<ChangelogRelease, 'bodyMd'> | null = null
  let body: string[] = []

  const flush = () => {
    if (current) releases.push({ ...current, bodyMd: body.join('\n').trim() })
    body = []
  }

  for (const line of lines) {
    const m = RELEASE_HEADING.exec(line.trim())
    if (m) {
      flush()
      current = { version: m[1], date: m[2] }
    } else if (current) {
      body.push(line)
    }
  }
  flush()
  return releases
}

/** Plain-text summary of a release body for RSS `<description>` — strips markdown syntax. */
export function summarizeMarkdown(md: string, maxLen = 400): string {
  const text = md
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > maxLen ? `${text.slice(0, maxLen - 1).trimEnd()}…` : text
}
