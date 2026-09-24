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
    <div className="flex items-center gap-2" role="tablist" aria-label={label}>
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
            className={`btn ${selected ? 'bg-primary-600 text-white hover:bg-primary-700' : ''}`}
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
