/**
 * Selection mode for one sequence (§8.13/roadmap "selection mode"): a per-sequence
 * on/off toggle plus the set of selected step ids. Scoped by mounting one
 * `<SelectionProvider>` per sequence — a branch lane and a macro body each render
 * their own `StepList`, so they each get independent selection state for free.
 * The context object and `useSelection()` live in selection.ts.
 */
import React, { useMemo, useState } from 'react'
import { SelectionCtx, type SelectionApi } from './selection'

export function SelectionProvider({ children }: { children: React.ReactNode }) {
  const [active, setActiveState] = useState(false)
  const [selectedSet, setSelectedSet] = useState<Set<string>>(() => new Set())
  const [toggleButton, setToggleButton] = useState<HTMLButtonElement | null>(null)

  const api = useMemo<SelectionApi>(() => ({
    active,
    setActive: v => { setActiveState(v); if (!v) setSelectedSet(new Set()) },
    selected: [...selectedSet],
    isSelected: id => selectedSet.has(id),
    toggle: id => setSelectedSet(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    }),
    clear: () => setSelectedSet(new Set()),
    contiguous: order => {
      const idxs = order.reduce<number[]>((acc, id, i) => { if (selectedSet.has(id)) acc.push(i); return acc }, [])
      return idxs.length > 0 && idxs.every((v, k) => k === 0 || v === idxs[k - 1] + 1)
    },
    toggleButton,
    setToggleButton,
  }), [active, selectedSet, toggleButton])

  return <SelectionCtx.Provider value={api}>{children}</SelectionCtx.Provider>
}
