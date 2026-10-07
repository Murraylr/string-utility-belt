import { globToRegExp, matchesAny } from './glob'
import { dependencyClosure, packageOfKey, type Lockfile } from './lockfile'
import type { Target } from './targets'

/** The difference between two revisions, with access to file contents on either side. */
export interface ChangeSet {
  /** Repo-relative paths added, removed or modified. */
  files: readonly string[]
  /** Contents before the change, or `null` when the file did not exist. */
  before(path: string): string | null
  /** Contents after the change, or `null` when the file no longer exists. */
  after(path: string): string | null
}

const ROOT_PACKAGE = 'package.json'
const ROOT_LOCK = 'package-lock.json'
/** Fields of the root package.json that pin a package a build may import. */
const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'] as const
const NONE: ReadonlySet<string> = new Set()
/** At most this many changed paths are listed as the reason for a release. */
const MAX_REASONS = 5

const compiled = new WeakMap<Target, { include: RegExp[]; exclude: RegExp[] }>()

function patterns(target: Target) {
  let p = compiled.get(target)
  if (!p) {
    p = { include: target.include.map(globToRegExp), exclude: target.exclude.map(globToRegExp) }
    compiled.set(target, p)
  }
  return p
}

/** Whether a change to `path` (other than the root manifests) changes what `target` ships. */
export function shipsPath(target: Target, path: string): boolean {
  const { include, exclude } = patterns(target)
  return matchesAny(path, include) && !matchesAny(path, exclude)
}

/**
 * Why `change` affects `target`: the changed paths it ships, and a summary of any
 * root manifest change that counts for it. Empty when the target is unaffected.
 *
 * `bundled` is the set of npm packages the target's build imports (`importGraph`):
 * for a `bundled` target, a manifest change counts only when it touches one of
 * them or something they depend on.
 */
export function affectedBy(target: Target, change: ChangeSet, bundled: ReadonlySet<string> = NONE): string[] {
  const reasons: string[] = []
  for (const file of change.files) {
    if (file === ROOT_PACKAGE || file === ROOT_LOCK) continue
    if (shipsPath(target, file)) reasons.push(file)
  }
  if (change.files.includes(ROOT_PACKAGE)) {
    const reason = rootPackageChange(target.rootManifest, bundled, change.before(ROOT_PACKAGE), change.after(ROOT_PACKAGE))
    if (reason) reasons.push(reason)
  }
  if (change.files.includes(ROOT_LOCK)) {
    const reason = lockfileChange(target.rootManifest, bundled, change.before(ROOT_LOCK), change.after(ROOT_LOCK))
    if (reason) reasons.push(reason)
  }
  return reasons.length > MAX_REASONS
    ? [...reasons.slice(0, MAX_REASONS), `…and ${reasons.length - MAX_REASONS} more`]
    : reasons
}

function rootPackageChange(mode: Target['rootManifest'], bundled: ReadonlySet<string>, before: string | null, after: string | null): string | null {
  const a = parseObject(before)
  const b = parseObject(after)
  if (mode === 'all') {
    return deepEqual(withoutKey(a, 'version'), withoutKey(b, 'version')) ? null : ROOT_PACKAGE
  }
  // a dependency the build imports, wherever package.json lists it (a devDependency is bundled all the same)
  const changed = [...bundled].filter(name => DEPENDENCY_FIELDS.some(f => a[f]?.[name] !== b[f]?.[name]))
  return changed.length ? `${ROOT_PACKAGE} (${sample(changed)})` : null
}

function lockfileChange(mode: Target['rootManifest'], bundled: ReadonlySet<string>, before: string | null, after: string | null): string | null {
  const a = parseObject(before) as Lockfile
  const b = parseObject(after) as Lockfile
  const pa = a.packages ?? {}
  const pb = b.packages ?? {}
  // what the build can contain, on either side of the change (a package it stops using shows up on one only)
  const shipped = mode === 'bundled'
    ? new Set([...dependencyClosure(a, bundled), ...dependencyClosure(b, bundled)])
    : null
  const changed: string[] = []
  for (const key of new Set([...Object.keys(pa), ...Object.keys(pb)])) {
    if (key === '') {
      // the root entry repeats package.json, whose changes are judged above (its version is a release's own edit)
      if (mode === 'all' && !deepEqual(withoutKey(pa[key], 'version'), withoutKey(pb[key], 'version'))) changed.push('(root)')
      continue
    }
    if (deepEqual(pa[key], pb[key]) || (shipped && !shipped.has(key))) continue
    changed.push(packageOfKey(key))
  }
  if (!changed.length) return null
  return `${ROOT_LOCK} (${shipped ? 'bundled ' : ''}${changed.length === 1 ? 'package' : 'packages'}: ${sample(changed)})`
}

function sample(names: readonly string[]): string {
  return `${names.slice(0, 3).join(', ')}${names.length > 3 ? ', …' : ''}`
}

function parseObject(text: string | null): Record<string, any> {
  if (text === null) return {}
  const value = JSON.parse(text)
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function withoutKey(value: unknown, key: string): unknown {
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([k]) => k !== key))
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  if (ka.length !== kb.length) return false
  return ka.every(k => Object.prototype.hasOwnProperty.call(b, k)
    && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}
