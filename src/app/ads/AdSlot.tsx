import React, { useEffect, useRef } from 'react'
import { ADSENSE_CLIENT, AD_SLOTS, type AdPlacement } from './config'

declare global {
  interface Window {
    /** The AdSense command queue `adsbygoogle.js` (loaded by index.html) drains. */
    adsbygoogle?: unknown[]
  }
}

/**
 * One responsive display ad unit, configured in `./config`. Each mount is a new
 * ad request, so an in-app navigation (which remounts the page) gets a fresh ad
 * like a full page load would. Renders nothing for a placement without an id.
 */
export default function AdSlot({ placement, className, slots = AD_SLOTS }: {
  placement: AdPlacement
  /** Layout classes for the unit's wrapper, e.g. to match the column it sits in. */
  className?: string
  /** For tests; defaults to `AD_SLOTS`. */
  slots?: Partial<Record<AdPlacement, string>>
}) {
  const slot = slots[placement]
  const requested = useRef(false)

  useEffect(() => {
    // StrictMode replays effects on the same <ins>; a second push would be rejected
    if (!slot || requested.current) return
    requested.current = true
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({})
    } catch {
      // adsbygoogle.js throws for a unit it cannot fill; an ad blocker may replace the queue
    }
  }, [slot])

  if (!slot) return null
  return (
    // reserves the unit's space up front so the ad does not shift the page when it arrives
    <aside className={className ? `ad-slot ${className}` : 'ad-slot'} aria-label="Advertisement">
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  )
}
