import React, { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { RECIPES_PATH } from '@/recipes/types'
import Dialog from './Dialog'
import type { RecipeGalleryProps } from './RecipeGallery'

/** What the dialog shows when its chunk cannot be fetched (offline, or a stale tab after a deploy). */
function GalleryUnavailable({ onClose, returnFocus }: RecipeGalleryProps) {
  return (
    <Dialog title="Recipes" onClose={onClose} returnFocus={returnFocus}>
      <p className="m-0 text-[13px] text-muted text-pretty">
        The recipe list could not be loaded. Check your connection, or{' '}
        <a className="underline underline-offset-[3px] hover:text-fg" href={RECIPES_PATH}>browse the recipes</a>.
      </p>
    </Dialog>
  )
}

// Lazy, so the recipe index (it grows with every recipe) stays out of the editor's entry chunk.
// A failed fetch degrades to a notice instead of throwing to the nearest error boundary.
const RecipeGallery = lazy(() =>
  import('./RecipeGallery').catch(() => ({ default: GalleryUnavailable })),
)

/** Opens the recipe gallery. Also opens on the `sub:open-recipes` window event. */
export default function RecipesButton() {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener('sub:open-recipes', onOpen)
    return () => window.removeEventListener('sub:open-recipes', onOpen)
  }, [])

  return (
    <>
      <button ref={buttonRef} className="btn h-[30px] px-2.5" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <BookOpen size={14} aria-hidden /> Recipes
      </button>
      {open && (
        <Suspense fallback={null}>
          <RecipeGallery onClose={() => setOpen(false)} returnFocus={buttonRef} />
        </Suspense>
      )}
    </>
  )
}
