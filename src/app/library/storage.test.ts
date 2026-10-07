import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deleteEntry, exportLibrary, getEntry, importLibrary, LIBRARY_KEY, listEntries, renameEntry, saveEntry,
} from './storage'

const step = (id: string, utilityId = 'trim') => ({ id, utilityId, enabled: true, params: {} })

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('storage: CRUD', () => {
  it('saveEntry creates a new pipeline entry, listEntries finds it, getEntry reads it', () => {
    const entry = saveEntry({ kind: 'pipeline', name: 'my pipeline', steps: [step('a')] })
    expect(entry.id).toBeTruthy()
    expect(listEntries('pipeline').map(e => e.id)).toContain(entry.id)
    expect(getEntry(entry.id)?.name).toBe('my pipeline')
  })

  it('saveEntry with an existing id overwrites in place instead of creating a second entry', () => {
    const first = saveEntry({ kind: 'pipeline', name: 'v1', steps: [step('a')] })
    const second = saveEntry({ id: first.id, kind: 'pipeline', name: 'v2', steps: [step('a'), step('b')] })
    expect(second.id).toBe(first.id)
    expect(listEntries('pipeline')).toHaveLength(1)
    expect(getEntry(first.id)?.name).toBe('v2')
    expect(getEntry(first.id)?.steps).toHaveLength(2)
  })

  it('keeps pipelines and macros separate when listing by kind', () => {
    saveEntry({ kind: 'pipeline', name: 'p', steps: [step('a')] })
    saveEntry({ kind: 'macro', name: 'm', steps: [step('a')] })
    expect(listEntries('pipeline')).toHaveLength(1)
    expect(listEntries('macro')).toHaveLength(1)
    expect(listEntries()).toHaveLength(2)
  })

  it('lists newest-updated first', async () => {
    const a = saveEntry({ kind: 'pipeline', name: 'a', steps: [step('a')] })
    await new Promise(r => setTimeout(r, 2))
    const b = saveEntry({ kind: 'pipeline', name: 'b', steps: [step('a')] })
    expect(listEntries('pipeline').map(e => e.id)).toEqual([b.id, a.id])
  })

  it('renameEntry updates the name and bumps updatedAt; a missing id is a no-op', () => {
    const entry = saveEntry({ kind: 'pipeline', name: 'old', steps: [step('a')] })
    renameEntry(entry.id, 'new name')
    expect(getEntry(entry.id)?.name).toBe('new name')
    renameEntry('does-not-exist', 'x')
    expect(listEntries('pipeline')).toHaveLength(1)
  })

  it('deleteEntry removes exactly that entry', () => {
    const a = saveEntry({ kind: 'pipeline', name: 'a', steps: [step('a')] })
    const b = saveEntry({ kind: 'pipeline', name: 'b', steps: [step('a')] })
    deleteEntry(a.id)
    expect(listEntries('pipeline').map(e => e.id)).toEqual([b.id])
  })
})

describe('storage: export / import round-trip', () => {
  it('exportLibrary then importLibrary(replace) reproduces every entry', () => {
    saveEntry({ kind: 'pipeline', name: 'p1', steps: [step('a')], input: 'hello' })
    saveEntry({ kind: 'macro', name: 'm1', steps: [step('b')] })
    const json = exportLibrary()

    localStorage.clear()
    expect(listEntries()).toHaveLength(0)

    const { added, skipped } = importLibrary(json, 'replace')
    expect(added).toBe(2)
    expect(skipped).toBe(0)
    const names = listEntries().map(e => e.name).sort()
    expect(names).toEqual(['m1', 'p1'])
    expect(listEntries('pipeline')[0].input).toBe('hello')
  })

  it('importLibrary(merge) skips entries whose id already exists', () => {
    const entry = saveEntry({ kind: 'pipeline', name: 'p1', steps: [step('a')] })
    const json = exportLibrary()
    const { added, skipped } = importLibrary(json, 'merge')
    expect(added).toBe(0)
    expect(skipped).toBe(1)
    expect(listEntries('pipeline')).toHaveLength(1)
    expect(getEntry(entry.id)?.name).toBe('p1')
  })

  it('importLibrary also accepts a single bare pipeline export ({ v, name, steps })', () => {
    const doc = JSON.stringify({ v: 2, name: 'solo pipeline', steps: [step('a')] })
    const { added } = importLibrary(doc, 'merge')
    expect(added).toBe(1)
    expect(listEntries('pipeline')[0].name).toBe('solo pipeline')
  })

  it('rejects invalid JSON and unrecognised shapes with a readable error', () => {
    expect(() => importLibrary('not json')).toThrow(/not valid JSON/i)
    expect(() => importLibrary(JSON.stringify({ foo: 'bar' }))).toThrow(/not a String Utility Belt library/i)
  })

  it('quarantines custom_js steps in every imported entry', () => {
    const doc = JSON.stringify({
      entries: [{
        id: 'e1', kind: 'pipeline', name: 'has code', createdAt: 1, updatedAt: 1,
        steps: [{ id: 's1', utilityId: 'custom_js', enabled: true, params: { code: 'return 1' } }],
      }],
    })
    importLibrary(doc, 'merge')
    const [entry] = listEntries('pipeline')
    expect(entry.steps[0].enabled).toBe(false)
  })

  it('leaves an imported entry with no code-running steps untouched', () => {
    const doc = JSON.stringify({
      entries: [{ id: 'e1', kind: 'pipeline', name: 'safe', createdAt: 1, updatedAt: 1, steps: [step('a')] }],
    })
    importLibrary(doc, 'merge')
    expect(listEntries('pipeline')[0].steps[0].enabled).toBe(true)
  })
})

describe('storage: sanitisation of hostile entries', () => {
  it('drops entries with no name, and repairs missing/duplicate ids', () => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({
      v: 2,
      entries: [
        { kind: 'pipeline', steps: [] }, // no name: dropped
        { id: 'dup', kind: 'pipeline', name: 'ok', steps: [{ utilityId: 'trim' }, { id: 'dup', utilityId: 'trim' }] },
      ],
    }))
    const entries = listEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('ok')
    const ids = entries[0].steps.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length) // no duplicate ids survive
  })

  it('strips __proto__/constructor/prototype keys out of step params instead of polluting the prototype', () => {
    const hostile = '{"v":2,"entries":[{"id":"e1","kind":"pipeline","name":"x","steps":[' +
      '{"id":"s1","utilityId":"trim","params":{"__proto__":{"polluted":true},"safe":1}}' +
      ']}]}'
    importLibrary(hostile, 'replace')
    const entry = listEntries('pipeline')[0]
    expect((entry.steps[0] as any).params).toEqual({ safe: 1 })
    expect(({} as any).polluted).toBeUndefined()
  })

  it('ignores a non-array entries field and a corrupted localStorage value instead of throwing', () => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({ v: 2, entries: 'not an array' }))
    expect(listEntries()).toEqual([])
    localStorage.setItem(LIBRARY_KEY, '{not json')
    expect(listEntries()).toEqual([])
  })

  it('caps name and description length', () => {
    const longName = 'x'.repeat(500)
    const entry = saveEntry({ kind: 'pipeline', name: longName, description: 'y'.repeat(2000), steps: [step('a')] })
    expect(entry.name.length).toBe(120)
    expect(entry.description?.length).toBe(1000)
  })
})

describe('storage: import edge cases', () => {
  it('stores an id that appears twice in one imported file only once', () => {
    const doc = JSON.stringify({
      entries: [
        { id: 'same', kind: 'pipeline', name: 'first', steps: [step('a')] },
        { id: 'same', kind: 'pipeline', name: 'second', steps: [step('b')] },
      ],
    })
    const { added, skipped } = importLibrary(doc, 'merge')
    expect(added).toBe(1)
    expect(skipped).toBe(1)
    expect(listEntries()).toHaveLength(1)
    expect(listEntries()[0].name).toBe('first')
  })

  it('counts entries that cannot be repaired (no name) as skipped instead of dropping them silently', () => {
    const doc = JSON.stringify({ entries: [{ kind: 'pipeline', steps: [] }, { id: 'ok', kind: 'pipeline', name: 'ok', steps: [] }] })
    expect(importLibrary(doc, 'merge')).toEqual({ added: 1, skipped: 1 })
  })

  it('keeps the input of a single downloaded pipeline file', () => {
    importLibrary(JSON.stringify({ v: 2, name: 'with input', steps: [step('a')], input: 'héllo 🎉' }), 'merge')
    expect(listEntries('pipeline')[0].input).toBe('héllo 🎉')
  })

  it('quarantines custom_js nested inside a branch lane and a macro body', () => {
    const code = { id: 'c1', utilityId: 'custom_js', enabled: true, params: { code: 'return 1' } }
    const code2 = { ...code, id: 'c2' }
    const doc = JSON.stringify({
      entries: [{
        id: 'e1', kind: 'pipeline', name: 'nested',
        steps: [
          { id: 'b1', type: 'branch', enabled: true, branches: [[code]], merge: { mode: 'concat', separator: '\n' } },
          { id: 'm1', type: 'macro', name: 'm', enabled: true, steps: [code2] },
        ],
      }],
    })
    importLibrary(doc, 'merge')
    const [entry] = listEntries('pipeline')
    expect((entry.steps[0] as any).branches[0][0].enabled).toBe(false)
    expect((entry.steps[1] as any).steps[0].enabled).toBe(false)
  })
})

describe('storage: hostile timestamps and versions', () => {
  const isRealDate = (ms: number) => !Number.isNaN(new Date(ms).getTime())

  it('repairs timestamps that are finite but not real dates (they would crash toISOString in the list)', () => {
    importLibrary(JSON.stringify({
      entries: [{ id: 'e1', kind: 'pipeline', name: 'odd', steps: [], createdAt: -1e300, updatedAt: 1e300 }],
    }), 'merge')
    const [entry] = listEntries()
    expect(isRealDate(entry.createdAt)).toBe(true)
    expect(isRealDate(entry.updatedAt)).toBe(true)
    expect(() => new Date(entry.updatedAt).toISOString()).not.toThrow()
  })

  it('repairs such timestamps when they are already in storage, too', () => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify({
      v: 2, entries: [{ id: 'e1', kind: 'pipeline', name: 'odd', steps: [], createdAt: 9e15, updatedAt: -9e15 }],
    }))
    const [entry] = listEntries()
    expect(isRealDate(entry.createdAt)).toBe(true)
    expect(isRealDate(entry.updatedAt)).toBe(true)
  })

  it('does not let an imported entry claim a future update time and pin itself to the top of the list', () => {
    const mine = saveEntry({ kind: 'pipeline', name: 'mine', steps: [step('a')] })
    importLibrary(JSON.stringify({
      entries: [{ id: 'e1', kind: 'pipeline', name: 'from the future', steps: [], createdAt: 1, updatedAt: Date.now() + 50 * 365 * 86_400_000 }],
    }), 'merge')
    expect(getEntry('e1')!.updatedAt).toBeLessThanOrEqual(Date.now())
    renameEntry(mine.id, 'mine, edited later')
    expect(listEntries('pipeline')[0].id).toBe(mine.id)
  })

  it('refuses a library file written by a newer schema version instead of silently dropping what it cannot read', () => {
    const doc = JSON.stringify({ v: 4, entries: [{ id: 'e1', kind: 'pipeline', name: 'new', steps: [] }] })
    expect(() => importLibrary(doc)).toThrow(/newer version/i)
    expect(listEntries()).toHaveLength(0)
  })

  it('will not overwrite a library that a newer version of the app wrote (e.g. a stale tab after a deploy)', () => {
    const newer = JSON.stringify({ v: 4, entries: [{ id: 'e1', kind: 'pipeline', name: 'from v4', steps: [], futureField: 1 }] })
    localStorage.setItem(LIBRARY_KEY, newer)
    expect(() => saveEntry({ kind: 'pipeline', name: 'x', steps: [step('a')] })).toThrow(/newer version/i)
    expect(localStorage.getItem(LIBRARY_KEY)).toBe(newer)
  })

  it('imports a bare array of steps (the earliest export format) as one pipeline', () => {
    expect(importLibrary(JSON.stringify([step('a'), step('b', 'upper')]), 'merge')).toEqual({ added: 1, skipped: 0 })
    const [entry] = listEntries('pipeline')
    expect(entry.name).toBe('imported pipeline')
    expect(entry.steps.map(s => (s as any).utilityId)).toEqual(['trim', 'upper'])
  })

  it('stores and exports the library as a schema v2 document while nothing needs v3', () => {
    saveEntry({ kind: 'pipeline', name: 'p', steps: [step('a')] })
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).v).toBe(2)
    expect(JSON.parse(exportLibrary()).v).toBe(2)
  })

  it('marks the library v3 once an entry has a "run on each" step, so an older tab refuses to rewrite it without it', () => {
    saveEntry({ kind: 'pipeline', name: 'p', steps: [step('a')] })
    const each = saveEntry({ kind: 'macro', name: 'per line', steps: [{ id: 'e', type: 'each', enabled: true, split: { mode: 'lines' }, steps: [step('b')] }] })
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).v).toBe(3)
    expect(JSON.parse(exportLibrary()).v).toBe(3)
    expect((getEntry(each.id)!.steps[0] as any).split).toEqual({ mode: 'lines' })
    deleteEntry(each.id)
    expect(JSON.parse(localStorage.getItem(LIBRARY_KEY)!).v).toBe(2)
  })

  it('renaming an entry to the name it already has is a no-op (it does not jump to the top)', async () => {
    const a = saveEntry({ kind: 'pipeline', name: 'a', steps: [step('a')] })
    await new Promise(r => setTimeout(r, 2))
    const b = saveEntry({ kind: 'pipeline', name: 'b', steps: [step('a')] })
    renameEntry(a.id, 'a')
    expect(getEntry(a.id)!.updatedAt).toBe(a.updatedAt)
    expect(listEntries('pipeline').map(e => e.id)).toEqual([b.id, a.id])
  })
})

describe('storage: write failures', () => {
  it('throws a readable error and leaves the library unchanged when storage is full', () => {
    saveEntry({ kind: 'pipeline', name: 'kept', steps: [step('a')] })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    expect(() => saveEntry({ kind: 'pipeline', name: 'too big', steps: [step('a')] })).toThrow(/storage/i)
    vi.restoreAllMocks()
    expect(listEntries().map(e => e.name)).toEqual(['kept'])
  })
})
