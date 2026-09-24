import React, { useEffect, useRef, useState } from 'react'
import { Share2 } from 'lucide-react'
import ShareDialog from './ShareDialog'

/** Opens the share dialog. Also opens on the `sub:open-share` window event. */
export default function ShareButton() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('sub:open-share', onOpen)
    return () => window.removeEventListener('sub:open-share', onOpen)
  }, [])

  return (
    <>
      <button ref={buttonRef} className="btn" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Share2 size={16} aria-hidden /> share
      </button>
      {open && <ShareDialog onClose={() => setOpen(false)} returnFocus={buttonRef} />}
    </>
  )
}
