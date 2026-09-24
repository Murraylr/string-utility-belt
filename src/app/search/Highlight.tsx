import React from 'react'
import type { FuzzyRange } from './fuzzy'

/** `text` with the fuzzy-matched `ranges` wrapped in `<mark>` (plain text when there are none). */
export default function Highlight({ text, ranges }: { text: string; ranges: FuzzyRange[] }) {
  if (!ranges.length) return <>{text}</>
  const nodes: React.ReactNode[] = []
  let last = 0
  ranges.forEach((r, i) => {
    if (r.start > last) nodes.push(text.slice(last, r.start))
    nodes.push(<mark key={i} className="bg-primary-500/30 text-inherit rounded-sm">{text.slice(r.start, r.end)}</mark>)
    last = r.end
  })
  if (last < text.length) nodes.push(text.slice(last))
  return <>{nodes}</>
}
