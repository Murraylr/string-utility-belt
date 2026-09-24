import React, { useEffect, useRef, useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import PresetGallery from './PresetGallery'

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
      <button ref={buttonRef} className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <LayoutGrid size={16} aria-hidden /> presets
      </button>
      {open && <PresetGallery onClose={() => setOpen(false)} returnFocus={buttonRef} />}
    </>
  )
}
