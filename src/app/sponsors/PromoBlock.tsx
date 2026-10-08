import React from 'react'
import { ChromeIcon, VsCodeIcon } from '@/app/integrations/icons'
import Slot from './Slot'
import { PROMOS, type PromoId } from './promos'

const ICONS: Record<PromoId, typeof ChromeIcon> = { chrome: ChromeIcon, vscode: VsCodeIcon }

/**
 * One of our own extensions in the sponsor slot: labelled as ours — never "Sponsor" — and
 * hidden on phones, which can install neither extension. Free of browser APIs, so the
 * pre-render can show it (`scripts/seo/content.ts`); the app chooses which in `HousePromo`.
 */
export default function PromoBlock({ id, onFollow, className }: {
  id: PromoId
  onFollow?: () => void
  className?: string
}) {
  const promo = PROMOS[id]
  const Icon = ICONS[id]
  return (
    <Slot
      label="From String Utility Belt"
      mark={<span className="sponsor-logo sponsor-mark"><Icon size={26} /></span>}
      name={promo.name}
      text={promo.text}
      href={promo.href}
      rel="noopener"
      onFollow={onFollow}
      className={className ? `hidden sm:flex ${className}` : 'hidden sm:flex'}
      data={{ 'data-promo': id }}
    />
  )
}
