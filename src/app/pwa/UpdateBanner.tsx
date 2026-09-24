import React, { useSyncExternalStore } from 'react'
import { onUpdateAvailable, isUpdateAvailable, applyUpdate } from './registerSW'

/**
 * A quiet bar that appears once a newer build has finished installing in the
 * background. Reloading hands control to it via the `SKIP_WAITING` message
 * (see `registerSW.applyUpdate`); the page reloads itself on `controllerchange`.
 * The live region is always mounted (visually hidden while empty) so screen
 * readers announce the message when it appears.
 */
export default function UpdateBanner() {
  const available = useSyncExternalStore(onUpdateAvailable, isUpdateAvailable, () => false)

  return (
    <div role="status" aria-live="polite" className={available ? 'max-w-7xl mx-auto px-4 pt-4' : 'sr-only'}>
      {available && (
        // aligned with the header/main content column rather than spanning the viewport
        <div className="card flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
          <span>A new version is available.</span>
          <button type="button" className="btn" onClick={() => applyUpdate()}>
            Reload
          </button>
        </div>
      )}
    </div>
  )
}
