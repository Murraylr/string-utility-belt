// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { affectedBy, deepEqual, shipsPath, type ChangeSet } from './changes'
import { targetById } from './targets'

const app = targetById('app')
const cli = targetById('cli')
const mcp = targetById('mcp')
const extension = targetById('extension')

function change(files: string[], before: Record<string, unknown> = {}, after: Record<string, unknown> = {}): ChangeSet {
  const text = (side: Record<string, unknown>, path: string) => (path in side ? JSON.stringify(side[path], null, 2) : null)
  return { files, before: p => text(before, p), after: p => text(after, p) }
}

const lock = (packages: Record<string, unknown>) => ({ name: 'x', version: '1.0.0', lockfileVersion: 3, packages })

describe('shipsPath', () => {
  it('ships the engine in every package, and the guides only on the site', () => {
    for (const target of [app, cli, mcp, extension]) {
      expect(shipsPath(target, 'src/core/runner.ts'), target.id).toBe(true)
      expect(shipsPath(target, 'src/utilities/pad/index.ts'), target.id).toBe(true)
    }
    expect(shipsPath(app, 'src/utilities/pad/guide.md')).toBe(true)
    expect(shipsPath(cli, 'src/utilities/pad/guide.md')).toBe(false)
  })

  it('keeps each package to its own directory', () => {
    expect(shipsPath(cli, 'packages/cli/src/main.ts')).toBe(true)
    expect(shipsPath(cli, 'packages/mcp/src/server.ts')).toBe(false)
    expect(shipsPath(app, 'packages/cli/src/main.ts')).toBe(false)
    expect(shipsPath(mcp, 'server.json')).toBe(true)
    expect(shipsPath(cli, 'server.json')).toBe(false)
  })

  it('never ships tests, fixtures, store copy or release tooling', () => {
    for (const path of ['src/core/runner.test.ts', 'src/utilities/__properties__/base64.test.ts', 'scripts/__fixtures__/sample-dist/index.html']) {
      expect(shipsPath(app, path), path).toBe(false)
      expect(shipsPath(cli, path), path).toBe(false)
    }
    expect(shipsPath(extension, 'packages/extension/tests/icons.test.ts')).toBe(false)
    expect(shipsPath(extension, 'packages/extension/store-listing/description.md')).toBe(false)
    expect(shipsPath(app, 'scripts/release/plan.ts')).toBe(false)
    expect(shipsPath(app, 'scripts/release.ts')).toBe(false)
    expect(shipsPath(app, 'scripts/check-bundle.ts')).toBe(false)
    expect(shipsPath(app, 'scripts/seo/build.ts')).toBe(true)
    expect(shipsPath(app, '.github/workflows/ci.yml')).toBe(false)
  })
})

describe('affectedBy', () => {
  it('lists the shipped paths that changed', () => {
    expect(affectedBy(cli, change(['packages/cli/README.md', 'README.md', 'src/core/a.test.ts']))).toEqual(['packages/cli/README.md'])
    expect(affectedBy(cli, change(['README.md', '.github/workflows/ci.yml']))).toEqual([])
  })

  it('caps the reasons it lists', () => {
    const files = Array.from({ length: 8 }, (_, i) => `src/core/f${i}.ts`)
    expect(affectedBy(cli, change(files))).toEqual([...files.slice(0, 5), '…and 3 more'])
  })

  it('ignores a root package.json version change for everyone', () => {
    const c = change(['package.json'], { 'package.json': { name: 'x', version: '1.0.0' } }, { 'package.json': { name: 'x', version: '1.0.1' } })
    expect(affectedBy(app, c)).toEqual([])
    expect(affectedBy(cli, c)).toEqual([])
  })

  it('counts any other root package.json change for the app, but only runtime dependencies for packages', () => {
    const scripts = change(['package.json'],
      { 'package.json': { scripts: { a: '1' }, devDependencies: { vite: '7' } } },
      { 'package.json': { scripts: { a: '2' }, devDependencies: { vite: '8' } } })
    expect(affectedBy(app, scripts)).toEqual(['package.json'])
    expect(affectedBy(cli, scripts)).toEqual([])

    const deps = change(['package.json'], { 'package.json': { dependencies: { yaml: '2.8' } } }, { 'package.json': { dependencies: { yaml: '2.9' } } })
    expect(affectedBy(cli, deps)).toEqual(['package.json (dependencies)'])
  })

  it('reads package-lock.json: dev-only packages matter to the app alone, runtime ones to everyone', () => {
    const devOnly = change(['package-lock.json'],
      { 'package-lock.json': lock({ '': { version: '1.0.0' }, 'node_modules/vite': { version: '7.0.0', dev: true } }) },
      { 'package-lock.json': lock({ '': { version: '1.0.0' }, 'node_modules/vite': { version: '7.1.0', dev: true } }) })
    expect(affectedBy(app, devOnly)).toEqual(['package-lock.json (package: vite)'])
    expect(affectedBy(cli, devOnly)).toEqual([])

    const runtime = change(['package-lock.json'],
      { 'package-lock.json': lock({ 'node_modules/yaml': { version: '2.8.0' }, 'node_modules/@scope/x/node_modules/y': { version: '1.0.0' } }) },
      { 'package-lock.json': lock({ 'node_modules/yaml': { version: '2.9.0' } }) })
    expect(affectedBy(cli, runtime)).toEqual(['package-lock.json (runtime packages: yaml, y)'])
  })

  it('ignores the lockfile\'s own copy of the root version', () => {
    const c = change(['package-lock.json'],
      { 'package-lock.json': { ...lock({ '': { name: 'x', version: '1.0.0' } }), version: '1.0.0' } },
      { 'package-lock.json': { ...lock({ '': { name: 'x', version: '1.0.1' } }), version: '1.0.1' } })
    expect(affectedBy(app, c)).toEqual([])
    expect(affectedBy(cli, c)).toEqual([])
  })

  it('treats a manifest added or removed like any other change', () => {
    const added = change(['package.json'], {}, { 'package.json': { dependencies: { a: '1' } } })
    expect(affectedBy(cli, added)).toEqual(['package.json (dependencies)'])
  })
})

describe('deepEqual', () => {
  it('compares structure, not key order', () => {
    expect(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 })).toBe(true)
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false)
    expect(deepEqual([1, 2], { 0: 1, 1: 2 })).toBe(false)
    expect(deepEqual(null, {})).toBe(false)
  })
})
