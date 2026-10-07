// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { shipsPath } from './changes'
import { globToRegExp } from './glob'
import { importGraph } from './imports'
import { dependencyClosure, type Lockfile } from './lockfile'
import { readTargetVersion } from './plan'
import { MANUAL_TARGETS, TARGETS, releaseTag, targetById } from './targets'

const ROOT = path.resolve(__dirname, '../..')
const read = (file: string) => readFileSync(path.join(ROOT, file), 'utf8')

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

  const bundledTargets = TARGETS.filter(t => t.rootManifest === 'bundled').map(t => [t.id, t] as const)

  it.each(bundledTargets)('%s: the path rules cover everything its build imports', (id, target) => {
    expect(target.entries.length, `${id} needs build entries`).toBeGreaterThan(0)
    const uncovered = [...importGraph(ROOT, target.entries).files].filter(f => !shipsPath(target, f))
    expect(uncovered, `${id} imports files its release rules ignore — add them to its include globs in targets.ts`).toEqual([])
  })

  it.each(bundledTargets)('%s: every npm package its build imports is installed (or a host-provided external)', (id, target) => {
    const lock = JSON.parse(read('package-lock.json')) as Lockfile
    const missing = [...importGraph(ROOT, target.entries).packages]
      .filter(name => !(lock.packages ?? {})[`node_modules/${name}`])
    // `vscode` is the extension host's own API, never installed or bundled
    expect(missing).toEqual(id === 'vscode' ? ['vscode'] : [])
  })

  it('bundles what each package really uses, and not the web app\'s dependencies', () => {
    const lock = JSON.parse(read('package-lock.json')) as Lockfile
    const shipped = (id: string) => {
      const keys = dependencyClosure(lock, importGraph(ROOT, targetById(id).entries).packages)
      return new Set([...keys].map(k => k.replace(/^node_modules\//, '')))
    }
    for (const id of ['core', 'cli', 'mcp', 'extension', 'vscode']) {
      const deps = shipped(id)
      // utilities lazy-load these
      for (const name of ['yaml', 'smol-toml', 'hash-wasm']) expect(deps.has(name), `${id} bundles ${name}`).toBe(true)
      for (const name of ['react', 'react-dom', 'framer-motion', '@codemirror/view', 'vite']) {
        expect(deps.has(name), `${id} must not count ${name}`).toBe(false)
      }
    }
    expect(shipped('mcp').has('@modelcontextprotocol/sdk')).toBe(true)
    expect(shipped('cli').has('@modelcontextprotocol/sdk')).toBe(false)
  })

  it('releases only the browser extension by hand', () => {
    expect(MANUAL_TARGETS).toEqual(['extension'])
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
