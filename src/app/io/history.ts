/**
 * Ring buffer of recent text inputs, persisted in IndexedDB (db `sub`, store `inputHistory`)
 * so it survives reloads. Degrades to an in-memory Map when indexedDB is unavailable (jsdom)
 * or unusable (privacy modes, disabled storage, a failed open) — same public API either way.
 */

export interface HistoryEntry {
  id: string
  text: string
  savedAt: number
}

const DB_NAME = 'sub'
const STORE_NAME = 'inputHistory'
export const HISTORY_LIMIT = 25
/** Preference (see usePref) that turns saving on/off; reading/restoring always works. */
export const HISTORY_PREF = 'inputHistory'
export const MAX_ENTRY_BYTES = 1024 * 1024

function hasIndexedDB(): boolean {
  return typeof indexedDB !== 'undefined' && indexedDB != null
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function openAt(version?: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = version === undefined ? indexedDB.open(DB_NAME) : indexedDB.open(DB_NAME, version)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('input history database upgrade is blocked by another tab'))
  })
}

/**
 * `sub` may be shared with other features, so open it at whatever version it already has and
 * bump the version only when our store is missing — a hard-coded version would fail with a
 * VersionError as soon as anyone else upgraded the database.
 */
async function openDb(): Promise<IDBDatabase> {
  let db = await openAt()
  if (!db.objectStoreNames.contains(STORE_NAME)) {
    const next = db.version + 1
    db.close()
    db = await openAt(next)
  }
  // let another tab's upgrade proceed; the next call reopens
  db.onversionchange = () => { db.close(); dbPromise = null }
  return db
}

let dbPromise: Promise<IDBDatabase | null> | null = null

/** The database, or null when IndexedDB is missing or refuses to open (then memory is used). */
function database(): Promise<IDBDatabase | null> {
  if (!hasIndexedDB()) return Promise.resolve(null)
  if (!dbPromise) dbPromise = openDb().catch(() => null)
  return dbPromise
}

function store(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME)
}

/** Fallback store used whenever IndexedDB is unavailable. */
const memoryStore = new Map<string, HistoryEntry>()

function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  } catch {
    /* fall through to the manual id */
  }
  return `h_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function byNewestFirst(a: HistoryEntry, b: HistoryEntry): number {
  return b.savedAt - a.savedAt
}

/**
 * `Date.now()` alone ties under fast successive saves (a debounce flush plus a manual run,
 * a tight test loop) — a stable sort then leaves ties in insertion order, silently reversing
 * "newest first". Folding in a monotonic counter keeps every save's timestamp strictly ordered.
 */
let saveSeq = 0
function nextSavedAt(): number {
  return Date.now() * 1000 + (saveSeq++ % 1000)
}

/**
 * Every operation runs one at a time: saveHistory is read-then-write (dedupe, trim), so two
 * overlapping saves of the same text would otherwise both miss the duplicate and insert twice.
 */
let queue: Promise<unknown> = Promise.resolve()
function serial<T>(op: () => Promise<T>): Promise<T> {
  const run = queue.then(op, op)
  queue = run.catch(() => undefined)
  return run
}

async function readAll(db: IDBDatabase | null): Promise<HistoryEntry[]> {
  const all = db ? await request(store(db, 'readonly').getAll() as IDBRequest<HistoryEntry[]>) : [...memoryStore.values()]
  return all.sort(byNewestFirst)
}

export function listHistory(): Promise<HistoryEntry[]> {
  return serial(async () => readAll(await database()))
}

/** Saves (or, for a duplicate text, re-dates and moves to front) an entry, then trims to HISTORY_LIMIT. */
export function saveHistory(text: string): Promise<void> {
  if (!text || text.length > MAX_ENTRY_BYTES || new TextEncoder().encode(text).length > MAX_ENTRY_BYTES) {
    return Promise.resolve()
  }
  return serial(async () => {
    const db = await database()
    const existing = await readAll(db)
    const dup = existing.find(e => e.text === text)
    const entry: HistoryEntry = { id: dup?.id ?? newId(), text, savedAt: nextSavedAt() }
    const kept = [entry, ...existing.filter(e => e.id !== entry.id)]
    const excess = kept.slice(HISTORY_LIMIT)
    if (db) {
      await request(store(db, 'readwrite').put(entry))
      for (const e of excess) await request(store(db, 'readwrite').delete(e.id))
    } else {
      memoryStore.set(entry.id, entry)
      for (const e of excess) memoryStore.delete(e.id)
    }
  })
}

export function deleteHistoryEntry(id: string): Promise<void> {
  return serial(async () => {
    const db = await database()
    if (db) await request(store(db, 'readwrite').delete(id))
    else memoryStore.delete(id)
  })
}

export function clearHistory(): Promise<void> {
  return serial(async () => {
    const db = await database()
    if (db) await request(store(db, 'readwrite').clear())
    else memoryStore.clear()
  })
}
