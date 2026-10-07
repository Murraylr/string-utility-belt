/** The parts of an npm v2/v3 `package-lock.json` the release planner reads. */
export interface Lockfile {
  packages?: Record<string, LockEntry>
}

export interface LockEntry {
  version?: string
  dev?: boolean
  link?: boolean
  resolved?: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/**
 * The lockfile keys (`node_modules/yaml`, `node_modules/a/node_modules/b`, …) of
 * `names` as the project root resolves them, and of everything they depend on —
 * the npm code a bundle importing `names` can contain. Resolution follows Node's
 * nested `node_modules` lookup; a dependency npm didn't install (an optional one
 * for another platform) is skipped.
 */
export function dependencyClosure(lock: Lockfile, names: Iterable<string>): Set<string> {
  const packages = lock.packages ?? {}
  const found = new Set<string>()
  const pending: string[] = []
  const visit = (from: string, name: string) => {
    const key = resolve(packages, from, name)
    if (key && !found.has(key)) {
      found.add(key)
      pending.push(key)
    }
  }
  for (const name of names) visit('', name)
  while (pending.length) {
    const key = pending.pop()!
    const entry = packages[key]
    const deps = { ...entry.peerDependencies, ...entry.optionalDependencies, ...entry.dependencies }
    for (const name of Object.keys(deps)) visit(key, name)
  }
  return found
}

/** Where Node finds package `name` imported from the package installed at `from` (`''` = the project root). */
function resolve(packages: Record<string, LockEntry>, from: string, name: string): string | null {
  let base = from
  for (;;) {
    const key = base ? `${base}/node_modules/${name}` : `node_modules/${name}`
    const entry = packages[key]
    if (entry) return entry.link && entry.resolved && packages[entry.resolved] ? entry.resolved : key
    if (!base) return null
    // up one level: node_modules/a/node_modules/@s/b → node_modules/a
    const nested = base.lastIndexOf('/node_modules/')
    base = nested < 0 ? '' : base.slice(0, nested)
  }
}

/** The display name of a lockfile key: `node_modules/a/node_modules/@s/b` → `@s/b`. */
export function packageOfKey(key: string): string {
  return key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length)
}
