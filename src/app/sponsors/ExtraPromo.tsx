import React from 'react'
import { INTEGRATION_ICONS } from '@/app/integrations/icons'
import { PROMOS, type ExtraSlot, type PromoId } from './promos'

const LABEL = 'From String Utility Belt'

/**
 * One of our own tools in an extra promo slot (`promoPlan`): a wide banner in the content
 * (`inline`), a card in the side column (`rail`) or a thin strip under the site header
 * (`strip`). Labelled as ours, never "Sponsor"; hidden on phones, where none of the tools
 * can be installed. A store page opens in a new tab, the CLI and MCP sections of
 * /integrations/ in place. Free of browser APIs, so the pre-render can show it; the app
 * passes `onFollow` to mark the integrations seen.
 */
export default function ExtraPromo({ id, slot, onFollow, className = '' }: {
  id: PromoId
  slot: ExtraSlot
  onFollow?: () => void
  className?: string
}) {
  const promo = PROMOS[id]
  const Icon = INTEGRATION_ICONS[id]
  const external = promo.link.external
  const linkProps = {
    href: promo.link.href,
    onClick: onFollow,
    ...(external ? { target: '_blank', rel: 'noopener' } : {}),
  }
  const newTab = external && <span className="sr-only"> (opens in a new tab)</span>
  const data = { 'data-promo': id, 'data-promo-slot': slot }

  if (slot === 'strip') {
    return (
      <aside aria-label={LABEL} {...data} className={`hidden sm:block border-b bg-strip ${className}`}>
        <div className="max-w-[1200px] mx-auto px-6 py-2 flex flex-wrap items-center gap-3 text-[12.5px]">
          <span className="chip border-line-2">{LABEL}</span>
          <span className="font-semibold">{promo.name}</span>
          <span className="text-muted flex-1 min-w-[200px]">{promo.text}</span>
          <a {...linkProps} className="font-medium text-acc hover:text-acc-hover">{promo.cta} <span aria-hidden="true">→</span>{newTab}</a>
        </div>
      </aside>
    )
  }

  if (slot === 'rail') {
    return (
      <aside aria-label={LABEL} {...data} className={`hidden sm:grid gap-2.5 p-3 border rounded-lg bg-surface ${className}`}>
        <span className="sponsor-label"><span>{LABEL}</span><a href="/advertise/">Advertise</a></span>
        <span className="h-[120px] rounded-md bg-acc text-on-acc grid place-items-center" aria-hidden="true"><Icon size={40} /></span>
        <span className="grid gap-[3px]">
          <span className="text-[13.5px] leading-[18px] font-semibold">{promo.name}</span>
          <span className="text-[12.5px] leading-[18px] text-muted text-pretty">{promo.text}</span>
        </span>
        <a {...linkProps} className="h-[30px] flex items-center justify-center border rounded-md text-[12.5px] font-medium hover:border-acc">{promo.cta}{newTab}</a>
      </aside>
    )
  }

  return (
    <aside aria-label={LABEL} {...data} className={`hidden sm:flex items-center gap-3.5 flex-wrap px-3.5 py-3 border rounded-lg bg-surface ${className}`}>
      <span className="size-11 shrink-0 rounded-lg bg-acc text-on-acc grid place-items-center" aria-hidden="true"><Icon size={20} /></span>
      <span className="flex-1 min-w-[200px] grid gap-0.5">
        <span className="text-[11px] text-muted">{LABEL}</span>
        <span className="text-[13.5px] font-semibold">{promo.name}</span>
        <span className="text-[12.5px] text-muted text-pretty">{promo.text}</span>
      </span>
      <a {...linkProps} className="h-[30px] px-3 flex items-center border rounded-md text-[12.5px] font-medium whitespace-nowrap hover:border-acc">{promo.cta}{newTab}</a>
    </aside>
  )
}
