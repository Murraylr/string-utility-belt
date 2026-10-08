import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Copy, Check, AlertCircle } from 'lucide-react'
import { asText, formatForDisplay, isBytes } from '@/core/coerce'
import { bytesToBase64, bytesToHex, utf8Encode } from '@/app/io/bytes'
import type { Value } from '@/types/utility'

export interface CopyAsMenuProps {
  value: Value
  /** Visible label; icon-only when omitted. */
  label?: string
  className?: string
  /** After a successful copy, with the format used. */
  onCopy?: (format: CopyFormat) => void
}

type CopyFormat = 'raw' | 'json-literal' | 'hex' | 'base64'

function formatValue(value: Value, format: CopyFormat): string {
  if (format === 'raw') return formatForDisplay(value)
  if (format === 'json-literal') return JSON.stringify(asText(value))
  if (format === 'hex') return isBytes(value) ? bytesToHex(value) : bytesToHex(utf8Encode(asText(value)))
  return isBytes(value) ? bytesToBase64(value) : bytesToBase64(utf8Encode(asText(value)))
}

/** `hint`: what "abc" looks like in that form. */
const MENU_ITEMS: Array<{ format: CopyFormat; label: string; hint: string }> = [
  { format: 'raw', label: 'Raw', hint: 'abc' },
  { format: 'json-literal', label: 'JSON string literal', hint: '"abc"' },
  { format: 'hex', label: 'Hex', hint: '616263' },
  { format: 'base64', label: 'Base64', hint: 'YWJj' },
]

/**
 * Copy button plus a "copy as" menu (JSON literal, hex, base64). With a `label` it is the
 * output's filled Copy button and a "Copy as" button; without, two compact icon buttons.
 */
export default function CopyAsMenu({ value, label, className, onCopy }: CopyAsMenuProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Which item gets focus when the menu opens (ArrowUp on the button opens at the last one). */
  const focusOnOpen = useRef<'first' | 'last'>('first')

  const announce = useCallback((next: 'copied' | 'error') => {
    setStatus(next)
    if (statusTimer.current) clearTimeout(statusTimer.current)
    statusTimer.current = setTimeout(() => setStatus('idle'), 1500)
  }, [])

  const copyAs = useCallback(async (format: CopyFormat) => {
    try {
      await navigator.clipboard.writeText(formatValue(value, format))
      announce('copied')
    } catch {
      announce('error')
      return
    }
    onCopy?.(format)
  }, [value, announce, onCopy])

  useEffect(() => () => { if (statusTimer.current) clearTimeout(statusTimer.current) }, [])

  useEffect(() => {
    if (!open) return undefined
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => !!el)
    items[focusOnOpen.current === 'last' ? items.length - 1 : 0]?.focus()
    const onDocMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [open])

  const closeMenu = useCallback(() => {
    setOpen(false)
    toggleRef.current?.focus()
  }, [])

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = itemRefs.current.filter((el): el is HTMLButtonElement => !!el)
    const currentIndex = items.findIndex(el => el === document.activeElement)
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      items[(currentIndex + 1) % items.length]?.focus()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      items[(currentIndex - 1 + items.length) % items.length]?.focus()
    } else if (e.key === 'Home') {
      e.preventDefault()
      items[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault()
      items[items.length - 1]?.focus()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeMenu()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const StatusIcon = status === 'copied' ? Check : status === 'error' ? AlertCircle : Copy

  return (
    <div className={`relative inline-flex ${label ? 'gap-1.5' : ''} ${className ?? ''}`} ref={containerRef}>
      <button
        type="button"
        className={label ? 'btn-inv min-w-[82px]' : 'icon-btn'}
        onClick={() => copyAs('raw')}
        aria-label={label ?? 'copy'}
      >
        <StatusIcon size={label ? 14 : 16} aria-hidden />
        {label && <span>{status === 'copied' ? 'Copied' : status === 'error' ? 'Failed' : label}</span>}
      </button>
      <button
        type="button"
        ref={toggleRef}
        className={label ? 'btn px-2.5' : 'icon-btn'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="copy as…"
        onClick={() => { focusOnOpen.current = 'first'; setOpen(o => !o) }}
        onKeyDown={e => {
          if (open || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return
          e.preventDefault()
          focusOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first'
          setOpen(true)
        }}
      >
        {label && <span aria-hidden>Copy as</span>}
        <ChevronDown size={label ? 13 : 14} className={label ? 'text-muted' : ''} aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="copy as"
          className={`popover absolute top-full mt-1.5 z-20 w-[230px] max-w-[calc(100vw-2rem)] ${label ? 'left-0' : 'right-0'}`}
          onKeyDown={onMenuKeyDown}
        >
          {MENU_ITEMS.map((item, i) => (
            <button
              key={item.format}
              role="menuitem"
              type="button"
              ref={el => { itemRefs.current[i] = el }}
              className="menu-item"
              onClick={() => { copyAs(item.format); closeMenu() }}
            >
              {item.label}
              <span className="font-mono text-[11px] text-muted" aria-hidden>{item.hint}</span>
            </button>
          ))}
        </div>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {status === 'copied' ? 'Copied' : status === 'error' ? 'Copy failed' : ''}
      </span>
    </div>
  )
}
