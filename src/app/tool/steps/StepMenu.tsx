/**
 * The step card's "more" menu (§8.13): duplicate, solo, rename, move, delete.
 * An accessible menu button — role="menu"/"menuitem", arrow-key navigation,
 * Escape closes and returns focus to the trigger.
 */
import React, { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'

export interface StepMenuProps {
  index: number
  total: number
  label?: string
  onDuplicate: () => void
  onSolo: () => void
  onRename: (label: string) => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

function MenuItemButtons({ items }: { items: Array<{ label: string; action: () => void; disabled?: boolean }> }) {
  return (
    <>
      {items.map(it => (
        <button key={it.label} type="button" role="menuitem" disabled={it.disabled} onClick={it.action}
          className="icon-btn justify-start w-full text-left px-2 disabled:opacity-40">
          {it.label}
        </button>
      ))}
    </>
  )
}

export default function StepMenu({
  index, total, label, onDuplicate, onSolo, onRename, onMoveUp, onMoveDown, onDelete,
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

  const items: Array<{ label: string; action: () => void; disabled?: boolean }> = [
    { label: 'Duplicate', action: () => { onDuplicate(); close() } },
    { label: 'Solo', action: () => { onSolo(); close() } },
    { label: 'Rename', action: startRename },
    { label: 'Move up', action: () => { onMoveUp(); close() }, disabled: index === 0 },
    { label: 'Move down', action: () => { onMoveDown(); close() }, disabled: index === total - 1 },
    { label: 'Delete', action: () => { onDelete(); close() } },
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
    onRename(draft)
    close()
  }

  return (
    <div className="relative">
      <button ref={btnRef} type="button" className="icon-btn" aria-haspopup="menu" aria-expanded={open}
        aria-label={`step ${index + 1} menu`} onClick={() => setOpen(o => !o)} onKeyDown={onTriggerKeyDown}>
        <MoreVertical size={16} />
      </button>
      {open && (
        // while renaming it holds a text field, which a role="menu" may not contain
        <div ref={menuRef} role={renaming ? 'group' : 'menu'} aria-label={renaming ? `rename step ${index + 1}` : `step ${index + 1} actions`}
          className="absolute right-0 z-10 mt-1 min-w-[11rem] card p-1 grid gap-0.5" onKeyDown={onMenuKeyDown}>
          {renaming ? (
            <form className="p-1" onSubmit={e => { e.preventDefault(); submitRename() }}>
              {/* 120: the longest label a share link / import keeps (core/serialize) */}
              <input autoFocus className="field w-full" aria-label="step name" value={draft} maxLength={120}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); close() } }} />
            </form>
          ) : <MenuItemButtons items={items} />}
        </div>
      )}
    </div>
  )
}
