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
      <button ref={buttonRef} className="btn h-[30px] px-2.5" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Share2 size={14} aria-hidden /> Share
      </button>
      {open && <ShareDialog onClose={() => setOpen(false)} returnFocus={buttonRef} />}
    </>
  )
}
