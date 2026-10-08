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
export default function UtilityGuide({ name, state, onOpen }: { name: string; state: GuideState; onOpen?: () => void }) {
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
    <details className="group border rounded-[10px] bg-surface min-w-0" aria-busy={state.status === 'loading' ? true : undefined}
      onToggle={e => { if (e.currentTarget.open) onOpen?.() }}>
      <summary className="px-4 py-3.5 flex items-center gap-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-[10px] hover:bg-surface-2 group-open:rounded-b-none group-open:border-b focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-acc">
        <span className="grid gap-0.5 flex-1 min-w-0">
          <h2 className="text-[15px] leading-[22px] font-semibold">{guideHeading(name)}</h2>
          <span className="text-[12.5px] text-muted">Detailed guide with worked examples</span>
        </span>
        <ChevronDown aria-hidden size={16} className="shrink-0 text-muted transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 sm:px-6 pt-5 pb-6 min-w-0">
        {state.status === 'loading'
          ? <p className="text-muted" role="status">Loading guide…</p>
          // trusted: parseGuide/renderGuideHtml escape every character of the source
          : <div className="md guide" onClick={onClick} dangerouslySetInnerHTML={{ __html: state.html }} />}
      </div>
    </details>
  )
}
