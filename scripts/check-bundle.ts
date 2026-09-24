/**
 * Bundle-size budget check (roadmap §13.4): parses a built `<dist>/index.html`
 * for its entry script(s) — `<script type="module" src>` plus any
 * `<link rel="modulepreload">` chunk, since both load before first paint — and
 * stylesheet, gzip-sizes them, totals every JS file under `<dist>/assets`,
 * finds the largest non-entry ("lazy") chunk by gzip size, and compares all
 * four against `bundle-budget.json`. Prints a table and exits non-zero on any
 * breach (or on a budget file with a missing/invalid metric).
 *
 * Usage:
 *   npm run check:bundle                      # dist/, budgets from bundle-budget.json
 *   npx vite-node scripts/check-bundle.ts --dist <dir>
 *
 * `analyzeDist`/`checkBudget` are exported and unit-tested against a fixture
 * dist in `check-bundle.test.ts` — keep them pure (no `process.exit`, no
 * console output) so that file can assert on their return values directly.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface FileSize {
  /** Path relative to the dist root, forward-slashed. */
  path: string
  raw: number
  gzip: number
}

export interface BundleReport {
  distDir: string
  /** Everything the page loads eagerly: module entry scripts, then modulepreloaded chunks. */
  entryJs: FileSize[]
  entryCss: FileSize[]
  /** Every `.js` file under `assets/` (entry chunks included). */
  allJs: FileSize[]
  totalJsRaw: number
  totalJsGzip: number
  largestLazyChunk: FileSize | null
}

export interface Budget {
  entryJsGzip: number
  entryCssGzip: number
  totalJsGzip: number
  largestLazyChunkGzip: number
}

export interface BudgetFile {
  measuredAt?: string
  measuredCommit?: string
  measured?: Partial<Budget>
  budget: Budget
}

/** Sizes a file, reporting its path relative to `distDir` (forward-slashed) for a readable table. */
const sizeOf = (distDir: string, absolutePath: string): FileSize => {
  const raw = readFileSync(absolutePath)
  const path = relative(distDir, absolutePath).split('\\').join('/')
  return { path, raw: raw.length, gzip: gzipSync(raw).length }
}

/** Local (same-origin) asset references only — `http(s)://` and `//` fonts/CDNs are not part of this bundle. */
const isLocalRef = (href: string) => !!href && !/^(?:[a-z]+:)?\/\//i.test(href)

/** Strips a leading `/` and any `?query`/`#hash` so an href maps cleanly onto a dist-relative path. */
function toDistRelative(href: string): string {
  return href.replace(/^\//, '').replace(/[?#].*$/, '')
}

function extractTags(html: string, tagName: string): string[] {
  const tagRe = new RegExp(`<${tagName}\\b[^>]*>`, 'gi')
  return html.match(tagRe) ?? []
}

/** A quoted attribute's value; the leading-whitespace anchor keeps `src` from matching `data-src`. */
function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)
  return m ? (m[1] ?? m[2]) : null
}

/** Whether a space-separated attribute value (e.g. `rel="preload stylesheet"`) contains `token`. */
const hasToken = (value: string | null, token: string) => (value ?? '').toLowerCase().split(/\s+/).includes(token)

/** Every `.js` file under `<distDir>/assets` (recursively — Vite's own layout is flat, but this
 * does not assume it), sized once. */
function collectAssetJs(distDir: string): FileSize[] {
  const assetsDir = join(distDir, 'assets')
  if (!existsSync(assetsDir)) return []
  const out: FileSize[] = []
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) { walk(full); continue }
      if (!entry.name.endsWith('.js')) continue
      out.push(sizeOf(distDir, full))
    }
  }
  walk(assetsDir)
  return out
}

/** Parses `<distDir>/index.html` and sizes every referenced file. Throws if index.html is missing. */
export function analyzeDist(distDir: string): BundleReport {
  const indexPath = join(distDir, 'index.html')
  if (!existsSync(indexPath)) {
    throw new Error(`no index.html found at "${indexPath}" — build first (npm run build), or pass --dist <dir>`)
  }
  const html = readFileSync(indexPath, 'utf-8')

  const links = extractTags(html, 'link')
  const moduleSrcs = extractTags(html, 'script')
    .filter((tag) => (attr(tag, 'type') || '').toLowerCase() === 'module')
    .map((tag) => attr(tag, 'src'))
  // Vite emits one per chunk the entry statically imports: they load before first paint too
  const preloadHrefs = links.filter((tag) => hasToken(attr(tag, 'rel'), 'modulepreload')).map((tag) => attr(tag, 'href'))
  const entryJsPaths = [
    ...new Set(
      [...moduleSrcs, ...preloadHrefs]
        .filter((src): src is string => !!src && isLocalRef(src))
        .map((src) => join(distDir, toDistRelative(src)))
    )
  ]
  const entryJs = entryJsPaths.map((p) => sizeOf(distDir, p))

  const entryCss = links
    .filter((tag) => hasToken(attr(tag, 'rel'), 'stylesheet'))
    .map((tag) => attr(tag, 'href'))
    .filter((href): href is string => !!href && isLocalRef(href))
    .map((href) => sizeOf(distDir, join(distDir, toDistRelative(href))))

  const allJs = collectAssetJs(distDir)
  // An asset is "entry" iff its absolute path matches a module script src or modulepreload href above.
  const entryAbsolutePaths = new Set(entryJsPaths)

  const totalJsRaw = allJs.reduce((n, f) => n + f.raw, 0)
  const totalJsGzip = allJs.reduce((n, f) => n + f.gzip, 0)

  // ranked by gzip, the unit the budget is in: raw size over-ranks repetitive, highly compressible code
  let largestLazyChunk: FileSize | null = null
  for (const f of allJs) {
    if (entryAbsolutePaths.has(join(distDir, f.path))) continue
    if (!largestLazyChunk || f.gzip > largestLazyChunk.gzip) largestLazyChunk = f
  }

  return { distDir, entryJs, entryCss, allJs, totalJsRaw, totalJsGzip, largestLazyChunk }
}

export interface Breach {
  metric: string
  actual: number
  budget: number
}

const BUDGET_KEYS: (keyof Budget)[] = ['entryJsGzip', 'entryCssGzip', 'totalJsGzip', 'largestLazyChunkGzip']

/**
 * The `budget` block of a parsed bundle-budget.json. Throws on a missing or non-positive
 * metric: `actual > undefined` is always false, so a typo'd key would otherwise switch
 * that check off without a word.
 */
export function parseBudget(file: unknown): Budget {
  const budget = (file as { budget?: unknown } | null)?.budget
  if (!budget || typeof budget !== 'object') throw new Error('bundle-budget.json has no "budget" object')
  for (const key of BUDGET_KEYS) {
    const v = (budget as Record<string, unknown>)[key]
    if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
      throw new Error(`bundle-budget.json: budget.${key} must be a positive number of bytes (got ${JSON.stringify(v)})`)
    }
  }
  return budget as Budget
}

/** Pure comparison — no I/O, no process.exit, so it is trivial to unit-test. */
export function checkBudget(report: BundleReport, budget: Budget): Breach[] {
  const entryJsGzip = report.entryJs.reduce((n, f) => n + f.gzip, 0)
  const entryCssGzip = report.entryCss.reduce((n, f) => n + f.gzip, 0)
  const largestLazyChunkGzip = report.largestLazyChunk?.gzip ?? 0

  const rows: [string, number, number][] = [
    ['entry JS (gzip)', entryJsGzip, budget.entryJsGzip],
    ['entry CSS (gzip)', entryCssGzip, budget.entryCssGzip],
    ['total JS (gzip)', report.totalJsGzip, budget.totalJsGzip],
    ['largest lazy chunk (gzip)', largestLazyChunkGzip, budget.largestLazyChunkGzip]
  ]

  return rows.filter(([, actual, max]) => actual > max).map(([metric, actual, budgetBytes]) => ({ metric, actual, budget: budgetBytes }))
}

const fmtKB = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`

export function formatTable(report: BundleReport, budget: Budget, breaches: Breach[]): string {
  const entryJsGzip = report.entryJs.reduce((n, f) => n + f.gzip, 0)
  const entryCssGzip = report.entryCss.reduce((n, f) => n + f.gzip, 0)
  const largestLazyChunkGzip = report.largestLazyChunk?.gzip ?? 0
  const breached = new Set(breaches.map((b) => b.metric))

  const rows: [string, number, number, string][] = [
    ['entry JS (gzip)', entryJsGzip, budget.entryJsGzip, report.entryJs.map((f) => f.path).join(', ') || '(none found)'],
    ['entry CSS (gzip)', entryCssGzip, budget.entryCssGzip, report.entryCss.map((f) => f.path).join(', ') || '(none found)'],
    ['total JS (gzip)', report.totalJsGzip, budget.totalJsGzip, `${report.allJs.length} file(s) under assets/`],
    ['largest lazy chunk (gzip)', largestLazyChunkGzip, budget.largestLazyChunkGzip, report.largestLazyChunk?.path ?? '(none found)']
  ]

  const nameW = Math.max(...rows.map((r) => r[0].length), 'metric'.length)
  const sizeW = Math.max(...rows.map((r) => fmtKB(r[1]).length), 'actual'.length)
  const budgetW = Math.max(...rows.map((r) => fmtKB(r[2]).length), 'budget'.length)
  const pad = (s: string, w: number) => s.padEnd(w)

  const lines: string[] = []
  lines.push(`${pad('metric', nameW)}  ${pad('actual', sizeW)}  ${pad('budget', budgetW)}  status`)
  for (const [name, actual, max, detail] of rows) {
    const status = breached.has(name) ? 'OVER BUDGET' : 'ok'
    lines.push(`${pad(name, nameW)}  ${pad(fmtKB(actual), sizeW)}  ${pad(fmtKB(max), budgetW)}  ${status}  (${detail})`)
  }
  return lines.join('\n')
}

// --- CLI entry ------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const distFlagIndex = args.indexOf('--dist')
  const distDir = distFlagIndex >= 0 && args[distFlagIndex + 1] ? args[distFlagIndex + 1] : 'dist'

  const budgetPath = new URL('../bundle-budget.json', import.meta.url)
  const budget = parseBudget(JSON.parse(readFileSync(fileURLToPath(budgetPath), 'utf-8')))

  const report = analyzeDist(distDir)
  const breaches = checkBudget(report, budget)

  console.log(`bundle-size budget check (${distDir})\n`)
  console.log(formatTable(report, budget, breaches))

  if (breaches.length > 0) {
    console.log('')
    console.error(
      `✗ ${breaches.length} budget breach(es):\n` +
        breaches.map((b) => `  - ${b.metric}: ${fmtKB(b.actual)} > budget ${fmtKB(b.budget)}`).join('\n')
    )
    process.exit(1)
  }
  console.log('\n✓ within budget')
}

// Skip the CLI when this module is `import`ed for its exports (as check-bundle.test.ts
// does) rather than executed directly — same `process.env.VITEST` guard vite.config.ts
// already uses, since vite-node does not rewrite `process.argv[1]` to the target file.
if (!process.env.VITEST) {
  main().catch((e) => {
    console.error(`[check-bundle] ${e?.message ?? e}`)
    process.exit(1)
  })
}
