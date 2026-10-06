import { globToRegExp, matchesAny } from './glob'
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
/** Fields of the root package.json that end up in bundled output. */
const RUNTIME_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies'] as const
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
 */
export function affectedBy(target: Target, change: ChangeSet): string[] {
  const reasons: string[] = []
  for (const file of change.files) {
    if (file === ROOT_PACKAGE || file === ROOT_LOCK) continue
    if (shipsPath(target, file)) reasons.push(file)
  }
  if (change.files.includes(ROOT_PACKAGE)) {
    const reason = rootPackageChange(target.rootManifest, change.before(ROOT_PACKAGE), change.after(ROOT_PACKAGE))
    if (reason) reasons.push(reason)
  }
  if (change.files.includes(ROOT_LOCK)) {
    const reason = lockfileChange(target.rootManifest, change.before(ROOT_LOCK), change.after(ROOT_LOCK))
    if (reason) reasons.push(reason)
  }
  return reasons.length > MAX_REASONS
    ? [...reasons.slice(0, MAX_REASONS), `…and ${reasons.length - MAX_REASONS} more`]
    : reasons
}

function rootPackageChange(mode: Target['rootManifest'], before: string | null, after: string | null): string | null {
  const a = parseObject(before)
  const b = parseObject(after)
  if (mode === 'all') {
    return deepEqual(withoutKey(a, 'version'), withoutKey(b, 'version')) ? null : `${ROOT_PACKAGE}`
  }
  const changed = RUNTIME_FIELDS.filter(f => !deepEqual(a[f], b[f]))
  return changed.length ? `${ROOT_PACKAGE} (${changed.join(', ')})` : null
}

function lockfileChange(mode: Target['rootManifest'], before: string | null, after: string | null): string | null {
  const a = (parseObject(before).packages ?? {}) as Record<string, any>
  const b = (parseObject(after).packages ?? {}) as Record<string, any>
  const changed: string[] = []
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    // the root entry repeats package.json (its version is a release's own edit)
    const [x, y] = key === '' ? [withoutKey(a[key], 'version'), withoutKey(b[key], 'version')] : [a[key], b[key]]
    if (deepEqual(x, y)) continue
    // npm marks packages only the dev tree needs with `dev: true`; anything else can be bundled
    const runtime = key === '' || (a[key] && !a[key].dev) || (b[key] && !b[key].dev)
    if (mode === 'all' || runtime) changed.push(key === '' ? '(root)' : key.replace(/^.*node_modules\//, ''))
  }
  if (!changed.length) return null
  const kind = mode === 'all' ? '' : 'runtime '
  const sample = changed.slice(0, 3).join(', ')
  return `${ROOT_LOCK} (${kind}${changed.length === 1 ? 'package' : 'packages'}: ${sample}${changed.length > 3 ? ', …' : ''})`
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
