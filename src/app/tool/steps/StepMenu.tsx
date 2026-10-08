/**
 * The step card's "more" menu (§8.13): duplicate, solo, rename, move, change utility, delete.
 * An accessible menu button — role="menu"/"menuitem", arrow-key navigation,
 * Escape closes and returns focus to the trigger.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'

export interface StepMenuProps {
  index: number
  total: number
  label?: string
  onDuplicate: () => void
  onSolo: () => void
  /** Omit for a step whose name is edited elsewhere (a macro's own name field). */
  onRename?: (label: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  /** Offered only for utility steps. */
  onChangeUtility?: () => void
}

interface Item {
  label: string
  action: () => void
  disabled?: boolean
  /** Shown muted after the label; not part of the item's name. */
  hint?: string
  keys?: string
  danger?: boolean
}

function MenuItemButtons({ items }: { items: Item[] }) {
  return (
    <>
      {items.map(it => (
        <button key={it.label} type="button" role="menuitem" disabled={it.disabled} onClick={it.action}
          aria-keyshortcuts={it.keys} className={`menu-item ${it.danger ? 'text-danger' : ''}`}>
          {it.label}
          {it.hint && <span className="font-mono text-[10.5px] text-muted" aria-hidden="true">{it.hint}</span>}
        </button>
      ))}
    </>
  )
}

export default function StepMenu({
  index, total, label, onDuplicate, onSolo, onRename, onMoveUp, onMoveDown, onDelete, onChangeUtility,
}: StepMenuProps) {
  const [open, setOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  /** Which item gets focus when the menu opens (ArrowUp on the trigger opens at the last one). */
  const focusOnOpen = useRef<'first' | 'last'>('first')

  const menuItems = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])

  const close = (returnFocus = true) => {
    setOpen(false)
    setRenaming(false)
    if (returnFocus) btnRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return
    const onDocDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [open])

  useEffect(() => {
    if (!open || renaming) return
    const items = menuItems()
    ;(focusOnOpen.current === 'last' ? items[items.length - 1] : items[0])?.focus()
    focusOnOpen.current = 'first'
  }, [open, renaming])

  const onTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
    e.preventDefault()
    focusOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first'
    setOpen(true)
  }

  const startRename = () => { setDraft(label ?? ''); setRenaming(true) }

  const items: Item[] = [
    { label: 'Duplicate', action: () => { onDuplicate(); close() } },
    { label: 'Solo', hint: 'others off', action: () => { onSolo(); close() } },
    ...(onRename ? [{ label: 'Rename', action: startRename }] : []),
    { label: 'Move up', hint: 'Alt+↑', keys: 'Alt+ArrowUp', action: () => { onMoveUp(); close() }, disabled: index === 0 },
    { label: 'Move down', hint: 'Alt+↓', keys: 'Alt+ArrowDown', action: () => { onMoveDown(); close() }, disabled: index === total - 1 },
    // the picker opens in the card and takes focus, so the trigger does not get it back
    ...(onChangeUtility ? [{ label: 'Change utility', action: () => { close(false); onChangeUtility() } }] : []),
    { label: 'Delete', danger: true, action: () => { onDelete(); close() } },
  ]

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); return }
    // menu-button pattern: Tab dismisses the menu and moves on. Refocus the trigger first so
    // the browser's default Tab continues from it, not from a menu item about to unmount.
    if (e.key === 'Tab') { close(); return }
    const focusable = menuItems()
    if (!focusable.length) return
    const i = focusable.indexOf(document.activeElement as HTMLButtonElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); focusable[(i + 1) % focusable.length]?.focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusable[(i - 1 + focusable.length) % focusable.length]?.focus() }
    else if (e.key === 'Home') { e.preventDefault(); focusable[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); focusable[focusable.length - 1]?.focus() }
  }

  const submitRename = () => {
    onRename?.(draft)
    close()
  }

  return (
    <div className="relative">
      <button ref={btnRef} type="button" className="size-7 grid place-items-center rounded-[5px] text-muted hover:bg-surface-2 hover:text-fg"
        aria-haspopup="menu" aria-expanded={open} title="Step actions"
        aria-label={`step ${index + 1} menu`} onClick={() => setOpen(o => !o)} onKeyDown={onTriggerKeyDown}>
        <Ellipsis size={15} aria-hidden="true" />
      </button>
      {open && (
        // while renaming it holds a text field, which a role="menu" may not contain
        <div ref={menuRef} role={renaming ? 'group' : 'menu'} aria-label={renaming ? `rename step ${index + 1}` : `step ${index + 1} actions`}
          className="popover absolute right-0 top-8 z-20 min-w-[180px] grid" onKeyDown={onMenuKeyDown}>
          {renaming ? (
            <form className="p-1" onSubmit={e => { e.preventDefault(); submitRename() }}>
              {/* 120: the longest label a share link / import keeps (core/serialize) */}
              <input autoFocus className="field w-full min-w-48" aria-label="step name" value={draft} maxLength={120}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }} />
            </form>
          ) : <MenuItemButtons items={items} />}
        </div>
      )}
    </div>
  )
}
