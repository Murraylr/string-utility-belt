export const REGEX_MAX_SCAN = 100_000
export const REGEX_MAX_MATCHES = 10_000

export interface MatchCount {
  count: number
  /** Stopped at REGEX_MAX_MATCHES. */
  capped: boolean
  /** Only the first REGEX_MAX_SCAN characters of the sample were searched. */
  truncated: boolean
}

/**
 * Counts matches in a bounded prefix of the sample (null for an invalid pattern/flags).
 * The caps bound the number of `exec` calls; they cannot stop a single catastrophic
 * backtracking `exec`, which only a worker with a timeout could.
 */
export function countMatches(pattern: string, flags: string, sample: string): MatchCount | null {
  let re: RegExp
  try {
    re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g')
  } catch {
    return null
  }
  const truncated = sample.length > REGEX_MAX_SCAN
  const text = truncated ? sample.slice(0, REGEX_MAX_SCAN) : sample
  const unicode = re.unicode || flags.includes('v')
  let count = 0
  let match: RegExpExecArray | null
  while (count < REGEX_MAX_MATCHES && (match = re.exec(text))) {
    count++
    if (match[0].length === 0) {
      // zero-length match: step past it (a whole code point in unicode mode)
      const cp = unicode ? text.codePointAt(re.lastIndex) : undefined
      re.lastIndex += cp !== undefined && cp > 0xffff ? 2 : 1
      if (re.lastIndex > text.length) break
    }
  }
  return { count, capped: count >= REGEX_MAX_MATCHES, truncated }
}
