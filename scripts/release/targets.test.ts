// @vitest-environment node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { shipsPath } from './changes'
import { globToRegExp } from './glob'
import { readTargetVersion } from './plan'
import { TARGETS, releaseTag, targetById, type TargetId } from './targets'

const ROOT = path.resolve(__dirname, '../..')
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8')

/** Each package's build entries: everything they import is what the package ships. */
const ENTRIES: Record<Exclude<TargetId, 'app'>, string[]> = {
  core: ['packages/core/src/index.ts'],
  cli: ['packages/cli/src/bin.ts'],
  mcp: ['packages/mcp/src/bin.ts'],
  extension: ['packages/extension/src/background.ts', 'packages/extension/src/popup.ts', 'packages/extension/src/options.ts'],
  vscode: ['packages/vscode/src/extension.ts'],
}

const IMPORT = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s+['"]([^'"]+)['"]/g
const EXTENSIONS = ['', '.ts', '.tsx', '.js', '.json', '/index.ts', '/index.tsx', '/index.js']

/** Repo files reachable from `entries` through relative and `@/` imports (npm packages aside). */
function importGraph(entries: string[]): Set<string> {
  const seen = new Set<string>()
  const stack = entries.map(e => path.join(ROOT, e))
  while (stack.length) {
    const file = stack.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    if (!/\.(tsx?|jsx?|mjs)$/.test(file)) continue
    for (const m of read(path.relative(ROOT, file)).matchAll(IMPORT)) {
      const spec = m[1] ?? m[2] ?? m[3]
      const base = spec.startsWith('@/') ? path.join(ROOT, 'src', spec.slice(2))
        : spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null
      if (!base) continue
      const resolved = EXTENSIONS.map(ext => base + ext).find(p => existsSync(p) && statSync(p).isFile())
      if (resolved) stack.push(resolved)
    }
  }
  return new Set([...seen].map(f => path.relative(ROOT, f).split(path.sep).join('/')))
}

function trackedFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git'].includes(entry.name)) continue
    const rel = dir ? `${dir}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...trackedFiles(rel))
    else out.push(rel)
  }
  return out
}

describe('release targets', () => {
  it('have unique ids, and tags that name them', () => {
    expect(new Set(TARGETS.map(t => t.id)).size).toBe(TARGETS.length)
    expect(releaseTag('cli', '1.3.1')).toBe('cli-v1.3.1')
    expect(() => targetById('nope')).toThrow(/unknown release target "nope"/)
  })

  it.each(TARGETS.map(t => [t.id, t] as const))('%s: every version file carries the same major.minor.patch version', (_id, target) => {
    expect(() => readTargetVersion(target, read)).not.toThrow()
  })

  it.each(Object.entries(ENTRIES))('%s: the path rules cover everything its build imports', (id, entries) => {
    const target = targetById(id)
    const uncovered = [...importGraph(entries)].filter(f => !shipsPath(target, f))
    expect(uncovered, `${id} imports files its release rules ignore — add them to its include globs in targets.ts`).toEqual([])
  })

  it('has no include glob that matches nothing (a renamed directory would silently stop releases)', () => {
    const files = trackedFiles('')
    for (const target of TARGETS) {
      for (const glob of target.include) {
        const re = globToRegExp(glob)
        expect(files.some(f => re.test(f)), `${target.id}: "${glob}" matches no file`).toBe(true)
      }
    }
  })

  it('keeps the MCP Registry entry pointing at the npm package it publishes', () => {
    const server = JSON.parse(read('server.json'))
    const pkg = JSON.parse(read('packages/mcp/package.json'))
    expect(server.packages[0]).toMatchObject({ registryType: 'npm', identifier: pkg.name })
    expect(server.name).toBe(pkg.mcpName)
  })
})
