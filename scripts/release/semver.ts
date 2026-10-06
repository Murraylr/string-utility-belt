/** How far a release moves the version: `x.y.z` → patch `x.y.(z+1)`, minor `x.(y+1).0`, major `(x+1).0.0`. */
export type BumpLevel = 'patch' | 'minor' | 'major'

const LEVEL_ORDER: readonly BumpLevel[] = ['patch', 'minor', 'major']

// Plain `major.minor.patch` only: the Chrome Web Store accepts dotted integers
// and nothing else, and every target shares one bump implementation.
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/

export function parseVersion(version: string): [number, number, number] {
  const m = VERSION.exec(version)
  if (!m) throw new Error(`"${version}" is not a plain major.minor.patch version`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export function isVersion(version: string): boolean {
  return VERSION.test(version)
}

/** Negative when `a` is lower than `b`, zero when equal, positive when higher. */
export function compareVersions(a: string, b: string): number {
  const x = parseVersion(a)
  const y = parseVersion(b)
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}

export function bumpVersion(version: string, level: BumpLevel): string {
  const [major, minor, patch] = parseVersion(version)
  if (level === 'major') return `${major + 1}.0.0`
  if (level === 'minor') return `${major}.${minor + 1}.0`
  return `${major}.${minor}.${patch + 1}`
}

/** The largest of `levels`, or `patch` when there are none. */
export function maxLevel(levels: Iterable<BumpLevel>): BumpLevel {
  let best: BumpLevel = 'patch'
  for (const level of levels) {
    if (LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(best)) best = level
  }
  return best
}
