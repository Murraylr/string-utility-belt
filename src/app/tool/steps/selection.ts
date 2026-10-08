/** The selection-mode context object and its hook (the provider lives in SelectionContext.tsx). */
import { createContext, useContext } from 'react'

export interface SelectionApi {
  active: boolean
  setActive: (v: boolean) => void
  selected: string[]
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  clear: () => void
  /** True when the selected ids form one contiguous run within `order`. */
  contiguous: (order: string[]) => boolean
  /** The on/off toggle, wherever it is rendered: where focus goes after a bulk action. */
  toggleButton: HTMLButtonElement | null
  /** Ref callback for that toggle. */
  setToggleButton: (el: HTMLButtonElement | null) => void
}

export const SelectionCtx = createContext<SelectionApi | null>(null)

/** The nearest sequence's selection state, or null outside a `<SelectionProvider>`. */
export const useSelection = (): SelectionApi | null => useContext(SelectionCtx)
