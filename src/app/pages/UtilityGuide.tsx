import React from 'react'
import { ChevronDown } from 'lucide-react'
import { isInAppPath, isPlainLeftClick, navigateToPath } from '@/lib/router'
import { guideHeading } from './guide'
import type { GuideState } from './useUtilityGuide'

/**
 * The doc page's expandable "How X works" guide. A native `<details>` keeps the
 * text in the DOM while collapsed, so search engines index it (and it works
 * without JS in the pre-rendered snapshot, which mirrors this markup).
 */
export default function UtilityGuide({ name, state }: { name: string; state: GuideState }) {
  if (state.status === 'missing') return null

  // guide links point at crawlable `/util/<id>/` paths; clicks stay in the app
  const onClick = (e: React.MouseEvent) => {
    const anchor = (e.target as Element).closest?.('a')
    const href = anchor?.getAttribute('href')
    if (!href || !isInAppPath(href) || !isPlainLeftClick(e, anchor)) return
    e.preventDefault()
    navigateToPath(href)
  }

  return (
    <details className="card group" aria-busy={state.status === 'loading' ? true : undefined}>
      <summary className="p-6 flex items-center gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
        <span className="grid gap-0.5 flex-1 min-w-0">
          <h2 className="text-lg font-medium">{guideHeading(name)}</h2>
          <span className="muted">Detailed guide with worked examples</span>
        </span>
        <ChevronDown aria-hidden className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-6 pb-6 min-w-0">
        {state.status === 'loading'
          ? <p className="muted" role="status">Loading guide…</p>
          // trusted: parseGuide/renderGuideHtml escape every character of the source
          : <div className="md guide" onClick={onClick} dangerouslySetInnerHTML={{ __html: state.html }} />}
      </div>
    </details>
  )
}
