import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { PRESETS_PATH } from '@/presets/types'
import Dialog from './Dialog'
import type { PresetGalleryProps } from './PresetGallery'

/** What the dialog shows when its chunk cannot be fetched (offline, or a stale tab after a deploy). */
function GalleryUnavailable({ onClose, returnFocus }: PresetGalleryProps) {
  return (
    <Dialog title="Presets" onClose={onClose} returnFocus={returnFocus}>
      <p className="m-0 text-[13px] text-muted text-pretty">
        The preset list could not be loaded. Check your connection, or{' '}
        <a className="underline underline-offset-[3px] hover:text-fg" href={PRESETS_PATH}>browse the presets</a>.
      </p>
    </Dialog>
  )
}

// Lazy, so the preset index (it grows with every preset) stays out of the editor's entry chunk.
// A failed fetch degrades to a notice instead of throwing to the nearest error boundary.
const PresetGallery = lazy(() =>
  import('./PresetGallery').catch(() => ({ default: GalleryUnavailable })),
)

/** Opens the preset gallery. Also opens on the `sub:open-presets` window event. */
export default function PresetsButton() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('sub:open-presets', onOpen)
    return () => window.removeEventListener('sub:open-presets', onOpen)
  }, [])

  return (
    <>
      <button ref={buttonRef} className="btn h-[30px] px-2.5" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <BookOpen size={14} aria-hidden /> Presets
      </button>
      {open && (
        <Suspense fallback={null}>
          <PresetGallery onClose={() => setOpen(false)} returnFocus={buttonRef} />
        </Suspense>
      )}
    </>
  )
}
