/**
 * Ctrl/Cmd+K (or "/", or the `sub:open-palette` event): fuzzy-search commands and
 * utilities in one list. Self-contained and mounted once at app level, OUTSIDE
 * `<ToolProvider>` — it never touches tool state directly, only through window
 * CustomEvents (`sub:tool-command`, handled by `ToolCommandBridge`).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { registry } from '@/app/registry'
import type { UtilityMeta } from '@/core/registry'
import { fuzzyScore, searchUtilities, type FuzzyRange } from '@/app/search/fuzzy'
import Highlight from '@/app/search/Highlight'
import { pushRecent, pushRecentCommand, useRecentCommands, useRecents } from '@/app/favorites'
import { useSearchTracking } from '@/app/analytics/analytics'
import {
  commands, commandById, dispatchToolCommand, hasToolBridge, runInTool,
  EVENT_OPEN_PALETTE, type Command, type OpenPaletteDetail,
} from './commands'
import { restoreFocus, trapTabKey, useBackdropDismiss } from './dialogA11y'
import { PALETTE_DIALOG_ATTR, useShortcuts } from './useShortcuts'

const MAX_RESULTS = 50
const MAX_RECENT_UTILITIES = 5
// same scale as searchUtilities' field weights, so commands and utilities interleave fairly
const WEIGHT_TITLE = 10
const WEIGHT_KEYWORD = 7
const ID_PREFIX = 'cmdk-'

type Mode = 'all' | 'utility'

/** `section` heads a group of options in the browse lists (no query); search results are one ranked list. */
type PaletteItem =
  | { kind: 'command'; command: Command; key: string; section?: string }
  | { kind: 'utility'; meta: UtilityMeta; nameRanges: FuzzyRange[]; key: string; section?: string }

const commandItem = (command: Command, section?: string): PaletteItem =>
  ({ kind: 'command', command, key: `${ID_PREFIX}c-${command.id}`, section })
const utilityItem = (meta: UtilityMeta, nameRanges: FuzzyRange[] = [], section?: string): PaletteItem =>
  ({ kind: 'utility', meta, nameRanges, key: `${ID_PREFIX}u-${meta.id}`, section })

/** Runs of consecutive items that share a section, in list order. */
function sections(items: PaletteItem[]): { name?: string; items: { item: PaletteItem; index: number }[] }[] {
  const out: { name?: string; items: { item: PaletteItem; index: number }[] }[] = []
  items.forEach((item, index) => {
    const last = out[out.length - 1]
    if (last && last.name === item.section) last.items.push({ item, index })
    else out.push({ name: item.section, items: [{ item, index }] })
  })
  return out
}

function scoreCommand(query: string, c: Command): number {
  const titleMatch = fuzzyScore(query, c.title)
  let best = titleMatch ? titleMatch.score * WEIGHT_TITLE : -Infinity
  for (const kw of c.keywords ?? []) {
    const m = fuzzyScore(query, kw)
    if (m) best = Math.max(best, m.score * WEIGHT_KEYWORD)
  }
  return best
}

/** Adds a utility as the next step of the pipeline editor on screen, or of the tool's. */
const addUtilityStep = (id: string) => runInTool(() => dispatchToolCommand({ command: 'addStep', utilityId: id }))

export default function CommandPalette() {
  // the palette's own keys; another useShortcuts() mount elsewhere is harmless (handled keys are
  // preventDefault-ed, and every listener skips an already-handled event)
  useShortcuts()
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>('all')
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [toolAvailable, setToolAvailable] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<Element | null>(null)
  /** Runs after the palette has closed and handed focus back (see the [open] effect). */
  const afterCloseRef = useRef<(() => void) | null>(null)
  const { recents } = useRecents()
  const { recentCommands } = useRecentCommands()
  const backdrop = useBackdropDismiss(() => setOpen(false))

  useEffect(() => {
    const onToggle = (e: Event) => {
      if (open) { setOpen(false); return }
      openerRef.current = document.activeElement
      const requested = (e as CustomEvent<OpenPaletteDetail | undefined>).detail?.mode
      setMode(requested === 'utility' ? 'utility' : 'all')
      setQuery(''); setActiveIndex(0); setToolAvailable(hasToolBridge()); setOpen(true)
    }
    window.addEventListener(EVENT_OPEN_PALETTE, onToggle)
    return () => window.removeEventListener(EVENT_OPEN_PALETTE, onToggle)
  }, [open])

  useEffect(() => {
    if (open) { inputRef.current?.focus(); return }
    restoreFocus(openerRef.current)
    // Run the chosen action only now: anything it opens (e.g. the shortcuts dialog)
    // then records the real opener and keeps focus, instead of racing our restore.
    const action = afterCloseRef.current
    afterCloseRef.current = null
    action?.()
  }, [open])

  // reset the active option during render (not an effect) whenever the list changes shape
  const resetKey = `${mode}\0${query}`
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  if (resetKey !== prevResetKey) { setPrevResetKey(resetKey); setActiveIndex(0) }

  const items: PaletteItem[] = useMemo(() => {
    const q = query.trim()
    const available = commands.filter(c => toolAvailable || !c.requiresTool)
    const recentMetas = recents
      .map(id => registry.get(id))
      .filter((m): m is UtilityMeta => !!m)

    if (mode === 'utility') {
      if (!q) {
        const recentIds = new Set(recentMetas.map(m => m.id))
        return [
          ...recentMetas.map(m => utilityItem(m, [], 'Recent')),
          ...registry.list().filter(m => !recentIds.has(m.id)).map(m => utilityItem(m, [], 'Utilities')),
        ].slice(0, MAX_RESULTS)
      }
      return searchUtilities(q, registry.list()).slice(0, MAX_RESULTS).map(r => utilityItem(r.meta, r.nameRanges))
    }

    if (!q) {
      // recent commands first, then recently added utilities, then every other command by group
      const recentCmds = recentCommands
        .map(id => commandById.get(id))
        .filter((c): c is Command => !!c && available.includes(c))
      const seen = new Set(recentCmds.map(c => c.id))
      const rest = available.filter(c => !seen.has(c.id))
      const groupOrder = [...new Set(rest.map(c => c.group))]
      return [
        ...recentCmds.map(c => commandItem(c, 'Recent')),
        ...recentMetas.slice(0, MAX_RECENT_UTILITIES).map(m => utilityItem(m, [], 'Recent utilities')),
        ...groupOrder.flatMap(group => rest.filter(c => c.group === group).map(c => commandItem(c, group))),
      ]
    }

    const cmdResults = available
      .map(command => ({ item: commandItem(command), score: scoreCommand(q, command) }))
      .filter(x => x.score > -Infinity)
    const utilResults = searchUtilities(q, registry.list())
      .map(r => ({ item: utilityItem(r.meta, r.nameRanges), score: r.score }))
    return [...cmdResults, ...utilResults]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS)
      .map(x => x.item)
  }, [mode, query, recents, recentCommands, toolAvailable])
  useSearchTracking('command_palette', open ? query : '', items.length)

  const clampedIndex = Math.max(0, Math.min(activeIndex, items.length - 1))

  const close = () => setOpen(false)
  const closeThen = (action: () => void) => { afterCloseRef.current = action; setOpen(false) }

  const selectItem = (item: PaletteItem) => {
    if (item.kind === 'command') {
      const { command } = item
      pushRecentCommand(command.id)
      const ctx = { setMode: (m: Mode) => { setMode(m); setQuery(''); inputRef.current?.focus() } }
      if (command.keepOpen) command.run(ctx)
      else closeThen(() => command.run(ctx))
      return
    }
    const id = item.meta.id
    pushRecent(id)
    closeThen(() => addUtilityStep(id))
  }

  const moveTo = (index: number) => {
    if (!items.length) return
    const next = Math.max(0, Math.min(index, items.length - 1))
    setActiveIndex(next)
    document.getElementById(items[next].key)?.scrollIntoView?.({ block: 'nearest' })
  }

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); moveTo(clampedIndex + 1); break
      case 'ArrowUp': e.preventDefault(); moveTo(clampedIndex - 1); break
      case 'Home': e.preventDefault(); moveTo(0); break
      case 'End': e.preventDefault(); moveTo(items.length - 1); break
      case 'Enter': {
        // modified Enter is a global shortcut (Ctrl/Cmd+Enter = run now), not a pick
        if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) break
        const item = items[clampedIndex]
        if (item) { e.preventDefault(); selectItem(item) }
        break
      }
      default:
        break
    }
  }

  const onDialogKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.preventDefault(); close(); return }
    trapTabKey(e, dialogRef.current)
  }

  if (!open) return null

  const activeKey = items[clampedIndex]?.key
  const dialogProps = { [PALETTE_DIALOG_ATTR]: '' }
  const searching = !!query.trim()

  const option = ({ item, index }: { item: PaletteItem; index: number }) => (
    <li
      key={item.key}
      id={item.key}
      role="option"
      aria-selected={index === clampedIndex}
      onMouseEnter={() => setActiveIndex(index)}
      onClick={() => selectItem(item)}
      className={`flex items-center justify-between gap-3 px-2.5 py-2 rounded-md cursor-pointer text-[13.5px] ${index === clampedIndex ? 'bg-surface-2' : ''}`}
    >
      {item.kind === 'command' ? (
        <>
          <span className="min-w-0">{item.command.title}</span>
          <span className="flex items-center gap-2 shrink-0 font-mono text-[11px] text-muted">
            {/* browsing shows the group as a heading; a ranked search names it per row */}
            {searching && <span>{item.command.group}</span>}
            {item.command.shortcut && <kbd className="kbd">{item.command.shortcut}</kbd>}
          </span>
        </>
      ) : (
        <>
          <span className="min-w-0"><Highlight text={item.meta.name} ranges={item.nameRanges} /></span>
          <span className="shrink-0 font-mono text-[11px] text-muted">{item.meta.category}</span>
        </>
      )}
    </li>
  )

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[9vh] pb-4 bg-black/35" {...backdrop}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${ID_PREFIX}title`}
        tabIndex={-1}
        {...dialogProps}
        className="w-full max-w-[560px] bg-surface border rounded-[10px] shadow-dialog outline-hidden"
        onKeyDown={onDialogKeyDown}
      >
        <h2 id={`${ID_PREFIX}title`} className="sr-only">
          {mode === 'utility' ? 'Add a utility' : 'Command palette'}
        </h2>
        <div className="flex items-center gap-2.5 h-[50px] px-3.5 border-b">
          <Search className="shrink-0 text-muted" size={16} aria-hidden />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls={`${ID_PREFIX}listbox`}
            aria-activedescendant={activeKey}
            aria-label={mode === 'utility' ? 'Search utilities' : 'Search commands and utilities'}
            className="flex-1 min-w-0 bg-transparent border-0 outline-hidden text-[15px]"
            placeholder={mode === 'utility' ? 'Search utilities' : 'Type a command or a utility'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <button type="button" className="kbd hover:text-fg" aria-label="close" onClick={close}>Esc</button>
        </div>
        <div role="status" className="sr-only">
          {searching ? `${items.length} ${items.length === 1 ? 'result' : 'results'}` : ''}
        </div>
        <ul
          id={`${ID_PREFIX}listbox`}
          role="listbox"
          aria-label={mode === 'utility' ? 'utilities' : 'commands and utilities'}
          className="m-0 p-1.5 list-none max-h-[min(420px,60vh)] overflow-auto"
        >
          {sections(items).map((section, i) => section.name ? (
            <li key={`${section.name}-${i}`} role="presentation">
              <div id={`${ID_PREFIX}g-${i}`} className="px-2.5 pt-2 pb-1 text-[11.5px] font-medium text-muted">{section.name}</div>
              <ul role="group" aria-labelledby={`${ID_PREFIX}g-${i}`} className="m-0 p-0 list-none">
                {section.items.map(option)}
              </ul>
            </li>
          ) : section.items.map(option))}
          {items.length === 0 && (
            <li role="presentation" className="px-2.5 py-[18px] text-[13px] text-muted">Nothing matches “{query.trim()}”.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
