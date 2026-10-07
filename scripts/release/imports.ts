import { existsSync, readFileSync, statSync } from 'node:fs'
import { builtinModules } from 'node:module'
import path from 'node:path'

/** What a build's entry points pull in: repo files, and the npm packages those files import. */
export interface ImportGraph {
  /** Repo-relative, forward-slash paths of every reachable source file (the entries included). */
  files: Set<string>
  /** Names of the npm packages imported anywhere in `files` (`yaml`, `@scope/name`). */
  packages: Set<string>
}

// `import x from 'm'`, `export … from 'm'`, `import 'm'`, `import('m')`, `require('m')`. The text before
// `from` is captured so type-only imports (erased at build time) can be told apart.
const MODULE_REFERENCE = /\b(import|export)(\s[^'"`;]*?)\bfrom\s*['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"]([^'"]+)['"]|\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const HTML_SCRIPT = /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi
const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '/index.ts', '/index.tsx', '/index.js']
const BUILTINS = new Set(builtinModules)

/**
 * Follows a build's imports from `entries` (TypeScript/JavaScript modules, or HTML pages
 * whose `<script src>` it follows) through relative and `@/` (= `src/`) specifiers.
 *
 * It reads source text rather than running the bundler, so it errs on the side of
 * including too much (an import inside a comment counts): fine for deciding what a
 * release depends on, where missing something is the failure that matters.
 */
export function importGraph(root: string, entries: readonly string[]): ImportGraph {
  const files = new Set<string>()
  const packages = new Set<string>()
  const pending = entries.map(e => path.resolve(root, e))
  for (const entry of pending) {
    if (!isFile(entry)) throw new Error(`build entry ${path.relative(root, entry)} does not exist`)
  }
  while (pending.length) {
    const file = pending.pop()!
    const rel = toPosix(path.relative(root, file))
    if (files.has(rel)) continue
    files.add(rel)
    const source = readFileSync(file, 'utf8')
    for (const spec of file.endsWith('.html') ? htmlScripts(source) : moduleSpecifiers(source)) {
      const local = resolveLocal(root, file, spec)
      if (local) pending.push(local)
      else {
        const name = packageName(spec)
        if (name) packages.add(name)
      }
    }
  }
  return { files, packages }
}

/** The module specifiers a source file references, type-only imports excepted. */
export function moduleSpecifiers(source: string): string[] {
  const specs: string[] = []
  for (const m of source.matchAll(MODULE_REFERENCE)) {
    if (m[3] !== undefined) {
      if (/^\s*type\b/.test(m[2])) continue
      specs.push(m[3])
    } else {
      specs.push((m[4] ?? m[5] ?? m[6])!)
    }
  }
  return specs
}

function htmlScripts(source: string): string[] {
  return [...source.matchAll(HTML_SCRIPT)].map(m => (m[1].startsWith('.') || m[1].startsWith('/') ? m[1] : `./${m[1]}`))
}

/** A relative or `@/` specifier resolved to a file, or `null` for anything else. */
function resolveLocal(root: string, from: string, spec: string): string | null {
  const bare = spec.replace(/[?#].*$/, '')
  const base = bare.startsWith('@/') ? path.join(root, 'src', bare.slice(2))
    : bare.startsWith('.') ? path.resolve(path.dirname(from), bare)
      : null
  if (!base) return null
  for (const suffix of RESOLVE_SUFFIXES) {
    if (isFile(base + suffix)) return base + suffix
  }
  throw new Error(`${toPosix(path.relative(root, from))} imports "${spec}", which resolves to no file`)
}

/** The npm package a bare specifier names (`@scope/name/sub` → `@scope/name`), or `null` for Node built-ins. */
export function packageName(spec: string): string | null {
  if (spec.startsWith('node:') || spec.startsWith('virtual:')) return null
  const parts = spec.split('/')
  const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
  return BUILTINS.has(name) || !name ? null : name
}

function isFile(p: string): boolean {
  return existsSync(p) && statSync(p).isFile()
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}
