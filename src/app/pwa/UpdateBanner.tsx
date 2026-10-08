import React, { useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import { onUpdateAvailable, isUpdateAvailable, applyUpdate } from './registerSW'

/**
 * A full-width bar above the header once a newer build has finished installing in the
 * background. Reloading hands control to it via the `SKIP_WAITING` message (see
 * `registerSW.applyUpdate`); the page reloads itself on `controllerchange`. Dismissing
 * hides it until the next page load. The live region is always mounted (visually hidden
 * while empty) so screen readers announce the message when it appears.
 */
export default function UpdateBanner() {
  const available = useSyncExternalStore(onUpdateAvailable, isUpdateAvailable, () => false)
  const [dismissed, setDismissed] = useState(false)
  const shown = available && !dismissed

  return (
    <div role="status" aria-live="polite" className={shown ? 'bg-inv text-on-inv' : 'sr-only'}>
      {shown && (
        <div className="max-w-[1440px] mx-auto px-6 py-[7px] flex items-center gap-3 text-[13px]">
          <span>A new version is available.</span>
          <button type="button" onClick={() => applyUpdate()}
            className="h-6 px-2.5 border border-on-inv rounded-[5px] text-[12.5px] font-medium">
            Reload
          </button>
          <span className="flex-1" />
          <button type="button" aria-label="Dismiss" onClick={() => setDismissed(true)}
            className="size-6 grid place-items-center">
            <X size={14} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
