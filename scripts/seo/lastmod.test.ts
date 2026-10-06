import { describe, it, expect, afterAll } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { discover } from '../gen-utilities'
import { SITE_PAGES } from '../../src/lib/router'
import {
  hashPages, hashSources, lastmodFor, latestDate, pageSources, readContentDates, staleKeys, updateContentDates,
  writeContentDates, sitePageKey, utilityKey, DOCS_KEY, LASTMOD_FILE, type ContentDates,
} from './lastmod'

const ROOT = process.cwd()
const tmpDirs: string[] = []

function fixtureRoot(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'lastmod-'))
  tmpDirs.push(root)
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true })
    writeFileSync(path.join(root, rel), content)
  }
  return root
}

afterAll(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true })
})

describe('scripts/seo/lastmod.json', () => {
  it('is up to date — run `npm run gen` if this fails', () => {
    const hashes = hashPages(ROOT, pageSources(ROOT, discover().map(d => d.dir), SITE_PAGES))
    expect(staleKeys(readContentDates(ROOT), hashes)).toEqual([])
  })

  it('holds only valid dates, never in the future', () => {
    const today = new Date().toISOString().slice(0, 10)
    for (const { hash, date } of Object.values(readContentDates(ROOT))) {
      expect(hash).toMatch(/^[0-9a-f]{16}$/)
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(date <= today).toBe(true)
    }
  })
})

describe('pageSources', () => {
  it("lists a utility's module and guide, a site page's markdown and the docs component", () => {
    const root = fixtureRoot({
      'src/utilities/a/index.ts': 'a',
      'src/utilities/a/guide.md': 'guide',
      'src/utilities/a/index.test.ts': 'not content',
      'src/utilities/b/index.tsx': 'b',
    })
    const sources = pageSources(root, ['a', 'b'], ['about'])
    expect(sources[utilityKey('a')]).toEqual([path.join('src/utilities/a/index.ts'), path.join('src/utilities/a/guide.md')])
    expect(sources[utilityKey('b')]).toEqual([path.join('src/utilities/b/index.tsx')])
    expect(sources[sitePageKey('about')]).toEqual([path.join('src/app/pages/content/about.md')])
    expect(sources[DOCS_KEY]).toEqual([path.join('src/components/Docs.tsx')])
  })
})

describe('hashSources', () => {
  it('changes with content and path, ignores CRLF vs LF', () => {
    const root = fixtureRoot({ 'x.md': 'one\ntwo\n', 'y.md': 'one\r\ntwo\r\n', 'z.md': 'one\ntwo!\n', 'd/x.md': 'one\ntwo\n' })
    const x = hashSources(root, ['x.md'])
    expect(x).toMatch(/^[0-9a-f]{16}$/)
    expect(hashSources(root, ['z.md'])).not.toBe(x)
    expect(hashSources(root, [path.join('d', 'x.md')])).not.toBe(x)
    // same path, CRLF content: what a Windows autocrlf checkout of x.md would hold
    const crlf = fixtureRoot({ 'x.md': readFileSync(path.join(root, 'y.md'), 'utf8') })
    expect(hashSources(crlf, ['x.md'])).toBe(x)
  })
})

describe('updateContentDates', () => {
  const previous: ContentDates = {
    'util/same': { hash: 'aaaa', date: '2026-01-01' },
    'util/changed': { hash: 'bbbb', date: '2026-01-01' },
    'util/removed': { hash: 'cccc', date: '2026-01-01' },
  }

  it('keeps unchanged dates, re-dates changed and new pages, drops removed ones, sorted', () => {
    const next = updateContentDates(previous, { 'util/same': 'aaaa', 'util/new': 'dddd', 'util/changed': 'eeee' }, '2026-02-03')
    expect(next).toEqual({
      'util/changed': { hash: 'eeee', date: '2026-02-03' },
      'util/new': { hash: 'dddd', date: '2026-02-03' },
      'util/same': { hash: 'aaaa', date: '2026-01-01' },
    })
    expect(Object.keys(next)).toEqual(['util/changed', 'util/new', 'util/same'])
  })

  it('rejects a malformed today', () => {
    expect(() => updateContentDates({}, {}, '2026-2-3')).toThrow(/YYYY-MM-DD/)
  })

  it('reports stale, missing and removed keys', () => {
    expect(staleKeys(previous, { 'util/same': 'aaaa', 'util/changed': 'ffff', 'util/new': '1111' }))
      .toEqual(['util/changed', 'util/new', 'util/removed'])
    expect(staleKeys(previous, { 'util/same': 'aaaa', 'util/changed': 'bbbb', 'util/removed': 'cccc' })).toEqual([])
  })
})

describe('lastmodFor / latestDate', () => {
  const recorded: ContentDates = { k: { hash: 'h1', date: '2026-01-01' }, bad: { hash: 'h2', date: 'yesterday' } }

  it('uses the recorded date only while the hash matches and the date is valid', () => {
    expect(lastmodFor(recorded, 'k', 'h1', '2026-09-09')).toBe('2026-01-01')
    expect(lastmodFor(recorded, 'k', 'other', '2026-09-09')).toBe('2026-09-09')
    expect(lastmodFor(recorded, 'k', undefined, '2026-09-09')).toBe('2026-09-09')
    expect(lastmodFor(recorded, 'missing', 'h1', '2026-09-09')).toBe('2026-09-09')
    expect(lastmodFor(recorded, 'bad', 'h2', '2026-09-09')).toBe('2026-09-09')
  })

  it('picks the latest date, or the fallback for none', () => {
    expect(latestDate(['2026-01-02', '2026-03-01', '2025-12-31'], '2020-01-01')).toBe('2026-03-01')
    expect(latestDate([], '2020-01-01')).toBe('2020-01-01')
  })
})

describe('writeContentDates', () => {
  it('writes the record, then leaves an unchanged one untouched', () => {
    const root = fixtureRoot({ 'scripts/seo/.keep': '' })
    expect(writeContentDates(root, { a: 'aaaa' }, '2026-01-01')).toBe(true)
    expect(readContentDates(root)).toEqual({ a: { hash: 'aaaa', date: '2026-01-01' } })
    // a later run with the same content keeps the original date
    expect(writeContentDates(root, { a: 'aaaa' }, '2026-05-05')).toBe(false)
    expect(readFileSync(path.join(root, LASTMOD_FILE), 'utf8')).toBe(`${JSON.stringify({ a: { hash: 'aaaa', date: '2026-01-01' } }, null, 2)}\n`)
  })

  it('reads an absent record as empty and rejects a malformed one', () => {
    expect(readContentDates(fixtureRoot({}))).toEqual({})
    expect(() => readContentDates(fixtureRoot({ [LASTMOD_FILE]: '[]' }))).toThrow(/JSON object/)
  })
})
