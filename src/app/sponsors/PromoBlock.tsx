import React from 'react'
import { INTEGRATION_ICONS } from '@/app/integrations/icons'
import Slot from './Slot'
import { PROMOS, type PromoId } from './promos'

/**
 * One of our own tools in the sponsor slot: labelled as ours — never "Sponsor" — and
 * hidden on phones, where none of them can be installed. A store page opens in a new
 * tab; the CLI and MCP server open their section of /integrations/ in place. Free of
 * browser APIs, so the pre-render can show it (`scripts/seo/content.ts`); the app
 * chooses which in `HousePromo`.
 */
export default function PromoBlock({ id, onFollow, className }: {
  id: PromoId
  onFollow?: () => void
  className?: string
}) {
  const promo = PROMOS[id]
  const Icon = INTEGRATION_ICONS[id]
  return (
    <Slot
      label="From String Utility Belt"
      mark={<span className="sponsor-logo sponsor-mark"><Icon size={26} /></span>}
      name={promo.name}
      text={promo.text}
      href={promo.link.href}
      rel={promo.link.external ? 'noopener' : undefined}
      newTab={promo.link.external}
      onFollow={onFollow}
      className={className ? `hidden sm:grid ${className}` : 'hidden sm:grid'}
      data={{ 'data-promo': id }}
    />
  )
}
