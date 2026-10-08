import React, { useRef } from 'react'

export interface TabsProps<T extends string> {
  label: string
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
  /** id of the element with role="tabpanel" these tabs control. */
  panelId: string
  /** Each tab gets the id `${idPrefix}-${tab.id}` so the panel can point back at it. */
  idPrefix: string
}

/**
 * WAI-ARIA tabs: one tab in the Tab order (roving tabindex), arrow keys / Home / End
 * move between tabs and select them.
 */
export default function Tabs<T extends string>({ label, tabs, value, onChange, panelId, idPrefix }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = tabs.length - 1
    const next = e.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
        : e.key === 'Home' ? 0
          : e.key === 'End' ? last
            : -1
    if (next < 0) return
    e.preventDefault()
    onChange(tabs[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div className="flex gap-0.5 -mt-1 mb-0.5 border-b" role="tablist" aria-label={label}>
      {tabs.map((t, i) => {
        const selected = t.id === value
        return (
          <button
            key={t.id}
            ref={el => { refs.current[i] = el }}
            id={`${idPrefix}-${t.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={`h-8 px-2.5 -mb-px border-b-2 text-[13px] font-medium ${selected ? 'border-acc text-fg' : 'border-transparent text-muted hover:text-fg'}`}
            onClick={() => onChange(t.id)}
            onKeyDown={e => onKeyDown(e, i)}
          >
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
