// @vitest-environment node
/**
 * Unit tests for `analyzeDist`/`checkBudget`/`formatTable` (roadmap §13.4)
 * against the fixture dist in `__fixtures__/sample-dist`. Expected sizes are
 * recomputed here with the same primitives (`readFileSync` + `gzipSync`)
 * rather than hardcoded, so the test stays correct if the fixture files ever
 * change without needing hand-updated byte counts.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'
import { analyzeDist, checkBudget, formatTable, parseBudget, type Budget } from './check-bundle'

const FIXTURE = path.join(__dirname, '__fixtures__', 'sample-dist')
/** Entry + `<link rel=modulepreload>` chunk, a `data-src` decoy, and two lazy chunks whose raw and gzip rankings disagree. */
const PRELOAD_FIXTURE = path.join(__dirname, '__fixtures__', 'preload-dist')

const gzipOf = (relPath: string) => gzipSync(readFileSync(path.join(FIXTURE, relPath))).length
const rawOf = (relPath: string) => readFileSync(path.join(FIXTURE, relPath)).length

describe('analyzeDist', () => {
  it('finds the entry <script type="module"> and stylesheet, ignoring cross-origin refs', () => {
    const report = analyzeDist(FIXTURE)
    expect(report.entryJs).toHaveLength(1)
    expect(report.entryJs[0].path).toBe('assets/entry-abc123.js')
    expect(report.entryCss).toHaveLength(1)
    expect(report.entryCss[0].path).toBe('assets/entry-abc123.css')
    // the Google Fonts <link rel=stylesheet> and the https:// analytics <script> are not local refs
    expect(report.entryCss.map((f) => f.path)).not.toContain('https://fonts.googleapis.com/css2?family=Test')
  })

  it('sizes raw and gzip correctly for a known file', () => {
    const report = analyzeDist(FIXTURE)
    const entry = report.entryJs[0]
    expect(entry.raw).toBe(rawOf('assets/entry-abc123.js'))
    expect(entry.gzip).toBe(gzipOf('assets/entry-abc123.js'))
  })

  it('collects every .js file under assets/ into allJs, including entry and lazy chunks', () => {
    const report = analyzeDist(FIXTURE)
    const paths = report.allJs.map((f) => f.path).sort()
    expect(paths).toEqual(['assets/chunk-big-def456.js', 'assets/chunk-small-ghi789.js', 'assets/entry-abc123.js'].sort())
  })

  it('totals JS raw/gzip across all chunks (entry + lazy)', () => {
    const report = analyzeDist(FIXTURE)
    const expectedRaw = rawOf('assets/entry-abc123.js') + rawOf('assets/chunk-big-def456.js') + rawOf('assets/chunk-small-ghi789.js')
    const expectedGzip = gzipOf('assets/entry-abc123.js') + gzipOf('assets/chunk-big-def456.js') + gzipOf('assets/chunk-small-ghi789.js')
    expect(report.totalJsRaw).toBe(expectedRaw)
    expect(report.totalJsGzip).toBe(expectedGzip)
  })

  it('picks the largest non-entry chunk as largestLazyChunk, excluding the entry script', () => {
    const report = analyzeDist(FIXTURE)
    expect(report.largestLazyChunk?.path).toBe('assets/chunk-big-def456.js')
    // the entry chunk must never be reported as a "lazy" chunk even though it lives under assets/ too
    expect(report.largestLazyChunk?.path).not.toBe('assets/entry-abc123.js')
  })

  it('throws a clear error when index.html is missing', () => {
    expect(() => analyzeDist(path.join(FIXTURE, 'assets'))).toThrow(/no index\.html found/i)
  })
})

describe('checkBudget', () => {
  const report = analyzeDist(FIXTURE)

  it('reports no breaches when every metric is within budget', () => {
    const generousBudget: Budget = { entryJsGzip: 10_000, entryCssGzip: 10_000, totalJsGzip: 10_000, largestLazyChunkGzip: 10_000 }
    expect(checkBudget(report, generousBudget)).toEqual([])
  })

  it('reports a breach per metric that exceeds its budget, with actual/budget values', () => {
    const tightBudget: Budget = { entryJsGzip: 1, entryCssGzip: 1, totalJsGzip: 10_000, largestLazyChunkGzip: 10_000 }
    const breaches = checkBudget(report, tightBudget)
    expect(breaches).toHaveLength(2)
    expect(breaches.map((b) => b.metric).sort()).toEqual(['entry CSS (gzip)', 'entry JS (gzip)'].sort())
    const entryJsBreach = breaches.find((b) => b.metric === 'entry JS (gzip)')!
    expect(entryJsBreach.actual).toBe(gzipOf('assets/entry-abc123.js'))
    expect(entryJsBreach.budget).toBe(1)
  })

  it('treats a missing largestLazyChunk (no lazy chunks) as zero, never breaching', () => {
    // a dist with only an entry chunk (no lazy chunks) should not fail the largest-lazy-chunk metric
    const onlyEntryReport = { ...report, allJs: report.entryJs, largestLazyChunk: null }
    const budget: Budget = { entryJsGzip: 10_000, entryCssGzip: 10_000, totalJsGzip: 10_000, largestLazyChunkGzip: 1 }
    expect(checkBudget(onlyEntryReport, budget)).toEqual([])
  })
})

describe('formatTable', () => {
  const report = analyzeDist(FIXTURE)

  it('marks breached metrics "OVER BUDGET" and clean ones "ok"', () => {
    const budget: Budget = { entryJsGzip: 1, entryCssGzip: 10_000, totalJsGzip: 10_000, largestLazyChunkGzip: 10_000 }
    const breaches = checkBudget(report, budget)
    const table = formatTable(report, budget, breaches)
    const jsLine = table.split('\n').find((l) => l.startsWith('entry JS'))!
    const cssLine = table.split('\n').find((l) => l.startsWith('entry CSS'))!
    expect(jsLine).toContain('OVER BUDGET')
    expect(cssLine).toContain('ok')
    expect(cssLine).not.toContain('OVER BUDGET')
  })

  it('lists the entry file paths and the lazy-chunk detail column', () => {
    const budget: Budget = { entryJsGzip: 10_000, entryCssGzip: 10_000, totalJsGzip: 10_000, largestLazyChunkGzip: 10_000 }
    const table = formatTable(report, budget, [])
    expect(table).toContain('assets/entry-abc123.js')
    expect(table).toContain('assets/chunk-big-def456.js')
  })
})

describe('analyzeDist: initial-load chunks and lazy-chunk ranking', () => {
  const sizeIn = (rel: string) => {
    const buf = readFileSync(path.join(PRELOAD_FIXTURE, rel))
    return { raw: buf.length, gzip: gzipSync(buf).length }
  }

  it('counts <link rel="modulepreload"> chunks as entry JS, and reads src rather than data-src', () => {
    const report = analyzeDist(PRELOAD_FIXTURE)
    expect(report.entryJs.map((f) => f.path)).toEqual(['assets/main.js', 'assets/vendor.js'])
    expect(report.entryCss.map((f) => f.path)).toEqual(['assets/main.css'])
    const entryGzip = checkBudget(report, { entryJsGzip: 1, entryCssGzip: 1e6, totalJsGzip: 1e6, largestLazyChunkGzip: 1e6 })[0].actual
    expect(entryGzip).toBe(sizeIn('assets/main.js').gzip + sizeIn('assets/vendor.js').gzip)
  })

  it('never reports a preloaded chunk as lazy, and ranks lazy chunks by gzip, not raw, size', () => {
    // the fixture only proves anything while the two rankings disagree
    expect(sizeIn('assets/lazy-repetitive.js').raw).toBeGreaterThan(sizeIn('assets/lazy-dense.js').raw)
    expect(sizeIn('assets/lazy-dense.js').gzip).toBeGreaterThan(sizeIn('assets/lazy-repetitive.js').gzip)

    const report = analyzeDist(PRELOAD_FIXTURE)
    expect(report.largestLazyChunk?.path).toBe('assets/lazy-dense.js')
    expect(report.largestLazyChunk?.gzip).toBe(sizeIn('assets/lazy-dense.js').gzip)
  })
})

describe('parseBudget', () => {
  const valid = { entryJsGzip: 1, entryCssGzip: 2, totalJsGzip: 3, largestLazyChunkGzip: 4 }

  it('returns the budget block when every metric is a positive number', () => {
    expect(parseBudget({ budget: valid })).toEqual(valid)
  })

  it.each([
    ['a missing metric', { ...valid, largestLazyChunkGzip: undefined }],
    ['a typo\'d key', { entryJSGzip: 1, entryCssGzip: 2, totalJsGzip: 3, largestLazyChunkGzip: 4 }],
    ['a string', { ...valid, totalJsGzip: '1750000' }],
    ['zero', { ...valid, entryCssGzip: 0 }],
    ['a negative number', { ...valid, entryJsGzip: -1 }]
  ])('throws on %s instead of silently skipping that check', (_label, budget) => {
    expect(() => parseBudget({ budget })).toThrow(/bundle-budget\.json/)
  })

  it('throws when there is no budget block at all', () => {
    expect(() => parseBudget({})).toThrow(/no "budget" object/)
    expect(() => parseBudget(null)).toThrow(/no "budget" object/)
  })
})

describe('bundle-budget.json (the committed budgets)', () => {
  const file = JSON.parse(readFileSync(path.join(__dirname, '..', 'bundle-budget.json'), 'utf-8'))
  const budget = parseBudget(file)
  const PRE_REFACTOR_ENTRY_GZIP = 458 * 1024

  it('is well-formed', () => {
    expect(budget.entryJsGzip).toBeGreaterThan(0)
  })

  it('keeps the entry-chunk budget far below the pre-refactor 458 KB entry', () => {
    expect(budget.entryJsGzip).toBeLessThan(PRE_REFACTOR_ENTRY_GZIP * 0.6)
  })

  it('records a measurement per metric, with each budget 5-30% above it', () => {
    for (const key of Object.keys(budget) as (keyof Budget)[]) {
      const measured = file.measured?.[key]
      expect(measured, `measured.${key}`).toBeTypeOf('number')
      expect(budget[key] / measured, key).toBeGreaterThanOrEqual(1.05)
      expect(budget[key] / measured, key).toBeLessThanOrEqual(1.3)
    }
  })
})
