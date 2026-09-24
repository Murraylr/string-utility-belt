/**
 * The user's library: saved pipelines and reusable macros, in localStorage.
 * One key holds every entry so export/import is a single JSON document.
 */
import { useEffect, useState } from 'react'
import type { PipelineStep } from '@/types/utility'
import { sanitizeSteps, SCHEMA_VERSION } from '@/core/serialize'
import { stepId } from '@/core/steps'
import { quarantineUntrusted } from '@/app/share/trust'

export const LIBRARY_KEY = 'sub:library'

export type EntryKind = 'pipeline' | 'macro'

export interface LibraryEntry {
  id: string
  kind: EntryKind
  name: string
  description?: string
  steps: PipelineStep[]
  /** Saved alongside a pipeline only when the user opts in. */
  input?: string
  createdAt: number
  updatedAt: number
}

type Listener = () => void
const listeners = new Set<Listener>()
const notify = () => listeners.forEach(fn => fn())

function readAll(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    const list = Array.isArray(parsed?.entries) ? parsed.entries : []
    return list.map(sanitizeEntry).filter(Boolean) as LibraryEntry[]
  } catch {
    return []
  }
}

/** Thrown when the browser refuses the write (quota exceeded, storage disabled). */
export class LibraryWriteError extends Error {}

/** Schema version of the stored library document (current version when absent or unreadable). */
function storedVersion(): number {
  try {
    const v = JSON.parse(localStorage.getItem(LIBRARY_KEY) || 'null')?.v
    return typeof v === 'number' ? v : SCHEMA_VERSION
  } catch {
    return SCHEMA_VERSION
  }
}

function writeAll(entries: LibraryEntry[]) {
  // A newer build (another tab, after a deploy) owns this document: rewriting it here
  // would silently drop every field this build does not know about.
  if (storedVersion() > SCHEMA_VERSION) {
    throw new LibraryWriteError('Your library was saved by a newer version of String Utility Belt. Reload the page to update before changing it.')
  }
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ v: SCHEMA_VERSION, entries }))
  } catch {
    throw new LibraryWriteError('Could not save to your library: browser storage is full or disabled.')
  }
  notify()
}

/** Largest |ms| a Date can hold; a finite number beyond it makes `toISOString()` throw. */
const MAX_DATE_MS = 8.64e15
const validTime = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= MAX_DATE_MS ? v : fallback

function sanitizeEntry(raw: any): LibraryEntry | null {
  if (!raw || typeof raw !== 'object' || typeof raw.name !== 'string') return null
  const kind: EntryKind = raw.kind === 'macro' ? 'macro' : 'pipeline'
  const now = Date.now()
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id.slice(0, 100) : stepId('lib'),
    kind,
    name: raw.name.slice(0, 120) || 'untitled',
    ...(typeof raw.description === 'string' ? { description: raw.description.slice(0, 1000) } : {}),
    steps: sanitizeSteps(raw.steps),
    ...(typeof raw.input === 'string' ? { input: raw.input } : {}),
    createdAt: validTime(raw.createdAt, now),
    updatedAt: validTime(raw.updatedAt, now),
  }
}

export function listEntries(kind?: EntryKind): LibraryEntry[] {
  const all = readAll()
  return (kind ? all.filter(e => e.kind === kind) : all).sort((a, b) => b.updatedAt - a.updatedAt)
}

export const getEntry = (id: string) => readAll().find(e => e.id === id)

export interface SaveInput {
  id?: string
  kind: EntryKind
  name: string
  description?: string
  steps: PipelineStep[]
  input?: string
}

/** Create, or overwrite the entry with `id`. Returns the stored entry. */
export function saveEntry(input: SaveInput): LibraryEntry {
  const all = readAll()
  const now = Date.now()
  const existing = input.id ? all.find(e => e.id === input.id) : undefined
  const entry = sanitizeEntry({
    ...input,
    id: existing?.id ?? input.id ?? stepId('lib'),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })!
  writeAll(existing ? all.map(e => (e.id === entry.id ? entry : e)) : [...all, entry])
  return entry
}

export function renameEntry(id: string, name: string): void {
  const all = readAll()
  const current = all.find(e => e.id === id)
  const next = name.slice(0, 120)
  if (!current || !next || next === current.name) return
  writeAll(all.map(e => (e.id === id ? { ...e, name: next, updatedAt: Date.now() } : e)))
}

export function deleteEntry(id: string): void {
  const all = readAll()
  const next = all.filter(e => e.id !== id)
  if (next.length !== all.length) writeAll(next)
}

/** The whole library as a portable JSON document. */
export function exportLibrary(): string {
  return JSON.stringify({ v: SCHEMA_VERSION, entries: readAll() }, null, 2)
}

/**
 * Import a document produced by `exportLibrary`, a single pipeline file
 * (`{ v, name?, steps }`) or a bare step array (the earliest export format).
 * `merge` keeps existing entries and skips ids already present; `replace` swaps
 * the library wholesale.
 */
export function importLibrary(json: string, mode: 'merge' | 'replace' = 'merge'): { added: number; skipped: number } {
  let parsed: any
  try { parsed = JSON.parse(json) } catch { throw new Error('That file is not valid JSON.') }
  if (typeof parsed?.v === 'number' && parsed.v > SCHEMA_VERSION) {
    throw new Error(`That file was made with a newer version of String Utility Belt (v${parsed.v}). Reload to update, then import it again.`)
  }
  if (Array.isArray(parsed)) parsed = { steps: parsed }
  const incoming: any[] = Array.isArray(parsed?.entries)
    ? parsed.entries
    : Array.isArray(parsed?.steps)
      ? [{
          kind: 'pipeline',
          name: typeof parsed.name === 'string' && parsed.name ? parsed.name : 'imported pipeline',
          steps: parsed.steps,
          description: parsed.description,
          input: parsed.input,
        }]
      : null as any
  if (!incoming) throw new Error('That file is not a String Utility Belt library or pipeline.')
  // Imported steps came from outside the app (a file on disk, handed around by anyone) —
  // never let a code-running step become active just because its file was imported.
  const seen = new Set<string>()
  const clean: LibraryEntry[] = []
  const now = Date.now()
  for (const raw of incoming) {
    const e = sanitizeEntry(raw)
    if (!e || seen.has(e.id)) continue // unrepairable, or the same id twice in one file
    seen.add(e.id)
    // a timestamp from the future would pin the entry above everything edited since
    clean.push({
      ...e,
      steps: quarantineUntrusted(e.steps).steps,
      createdAt: Math.min(e.createdAt, now),
      updatedAt: Math.min(e.updatedAt, now),
    })
  }
  const unusable = incoming.length - clean.length
  if (mode === 'replace') { writeAll(clean); return { added: clean.length, skipped: unusable } }
  const all = readAll()
  const ids = new Set(all.map(e => e.id))
  const fresh = clean.filter(e => !ids.has(e.id))
  if (fresh.length) writeAll([...all, ...fresh])
  return { added: fresh.length, skipped: incoming.length - fresh.length }
}

/** Subscribe to library changes (this tab and others). */
export function useLibrary(kind?: EntryKind): LibraryEntry[] {
  const [entries, setEntries] = useState(() => listEntries(kind))
  useEffect(() => {
    const update = () => setEntries(listEntries(kind))
    update() // `kind` may have changed since the last render (e.g. switching tabs)
    listeners.add(update)
    const onStorage = (e: StorageEvent) => { if (e.key === LIBRARY_KEY) update() }
    window.addEventListener('storage', onStorage)
    return () => { listeners.delete(update); window.removeEventListener('storage', onStorage) }
  }, [kind])
  return entries
}
