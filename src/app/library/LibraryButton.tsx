import React, { useEffect, useRef, useState } from 'react'
import { Library } from 'lucide-react'
import LibraryDialog from './LibraryDialog'

/** Opens the library (saved pipelines + macros). Also opens on the `sub:open-library` window event. */
export default function LibraryButton() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('sub:open-library', onOpen)
    return () => window.removeEventListener('sub:open-library', onOpen)
  }, [])

  return (
    <>
      <button ref={buttonRef} className="btn h-[30px] px-2.5" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <Library size={14} aria-hidden /> Library
      </button>
      {open && <LibraryDialog onClose={() => setOpen(false)} returnFocus={buttonRef} />}
    </>
  )
}
