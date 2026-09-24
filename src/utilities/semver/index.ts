import type { Utility } from '@/types/utility'

type Ident = string | number

type Parsed = {
  raw: string
  version: string
  major: number
  minor: number
  patch: number
  prerelease: Ident[]
  build: string[]
}

type Op = '>' | '>=' | '<' | '<=' | '='

type Comparator = { op: Op; v: Parsed; source: string }

// Official SemVer 2.0.0 regular expression (semver.org).
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/

const NUMERIC_ID = /^(0|[1-9]\d*)$/

const formatVersion = (p: { major: number; minor: number; patch: number; prerelease: Ident[] }) =>
  `${p.major}.${p.minor}.${p.patch}${p.prerelease.length ? `-${p.prerelease.join('.')}` : ''}`

/** Parse a version string into its SemVer parts, or null when it is not valid SemVer. */
export function parseVersion(value: string): Parsed | null {
  const raw = String(value ?? '').trim()
  const cleaned = raw.replace(/^[v=]+\s*/i, '')
  const m = SEMVER_RE.exec(cleaned)
  if (!m) return null
  const prerelease: Ident[] = m[4]
    ? m[4].split('.').map((id) => (NUMERIC_ID.test(id) ? Number(id) : id))
    : []
  const build = m[5] ? m[5].split('.') : []
  const parsed: Parsed = {
    raw,
    version: '',
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease,
    build
  }
  parsed.version = formatVersion(parsed)
  return parsed
}

const mustParse = (value: string, what = 'version'): Parsed => {
  const p = parseVersion(value)
  if (!p) throw new Error(`not a valid semver ${what}: "${String(value).trim()}"`)
  return p
}

const cmpNum = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0)

const cmpIdent = (a: Ident, b: Ident): number => {
  const an = typeof a === 'number'
  const bn = typeof b === 'number'
  // numeric identifiers always have lower precedence than alphanumeric ones
  if (an && bn) return cmpNum(a as number, b as number)
  if (an) return -1
  if (bn) return 1
  const as = String(a)
  const bs = String(b)
  return as < bs ? -1 : as > bs ? 1 : 0
}

const cmpPrerelease = (a: Ident[], b: Ident[]): number => {
  // a version WITHOUT a prerelease outranks one with a prerelease
  if (!a.length && !b.length) return 0
  if (!a.length) return 1
  if (!b.length) return -1
  const len = Math.min(a.length, b.length)
  for (let i = 0; i < len; i++) {
    const c = cmpIdent(a[i], b[i])
    if (c !== 0) return c
  }
  return cmpNum(a.length, b.length)
}

/** SemVer 2.0.0 precedence. Build metadata is ignored, as the spec requires. */
export function compareVersions(a: Parsed, b: Parsed): number {
  return (
    cmpNum(a.major, b.major) ||
    cmpNum(a.minor, b.minor) ||
    cmpNum(a.patch, b.patch) ||
    cmpPrerelease(a.prerelease, b.prerelease)
  )
}

// ---------------------------------------------------------------------------
// ranges
// ---------------------------------------------------------------------------

const ZERO = (): Parsed => mustParse('0.0.0')
// A comparator that nothing can satisfy (lower than every real version).
const NOTHING = (): Parsed => mustParse('0.0.0-0')

type Partial = {
  major: number | null
  minor: number | null
  patch: number | null
  prerelease: Ident[]
}

const PARTIAL_RE =
  /^(\d+|[xX*])(?:\.(\d+|[xX*]))?(?:\.(\d+|[xX*]))?(?:-([0-9A-Za-z.-]+))?(?:\+([0-9A-Za-z.-]+))?$/

const partOf = (s: string | undefined): number | null =>
  s === undefined || s === '' || s === 'x' || s === 'X' || s === '*' ? null : Number(s)

const parsePartial = (raw: string): Partial => {
  const s = raw.replace(/^[v=]+\s*/i, '').trim()
  if (s === '' || s === '*' || s === 'x' || s === 'X') {
    return { major: null, minor: null, patch: null, prerelease: [] }
  }
  const m = PARTIAL_RE.exec(s)
  if (!m) throw new Error(`unrecognised version in range: "${raw}"`)
  const major = partOf(m[1])
  const minor = partOf(m[2])
  const patch = partOf(m[3])
  const prerelease: Ident[] = m[4]
    ? m[4].split('.').map((id) => (NUMERIC_ID.test(id) ? Number(id) : id))
    : []
  return { major, minor, patch, prerelease }
}

const at = (major: number, minor: number, patch: number, prerelease: Ident[] = []): Parsed => {
  const p: Parsed = { raw: '', version: '', major, minor, patch, prerelease, build: [] }
  p.version = formatVersion(p)
  p.raw = p.version
  return p
}

const cmp = (op: Op, source: string, v: Parsed): Comparator => ({ op, v, source })

/** Expand a single range comparator (`^1.2`, `>=3`, `1.x`, …) into primitive comparators. */
function expandComparator(token: string): Comparator[] {
  const m = /^(<=|>=|<|>|=|\^|~>|~)?\s*(.*)$/.exec(token.trim())
  if (!m) throw new Error(`unrecognised range comparator: "${token}"`)
  const op = (m[1] === '~>' ? '~' : m[1] ?? '') as string
  const rest = m[2]
  const p = parsePartial(rest)
  const { major: M, minor: mi, patch: pa, prerelease: pre } = p
  const anyVersion = () => [cmp('>=', token, ZERO())]
  const nothing = () => [cmp('<', token, NOTHING())]

  switch (op) {
    case '':
    case '=': {
      if (M === null) return anyVersion()
      if (mi === null) return [cmp('>=', token, at(M, 0, 0)), cmp('<', token, at(M + 1, 0, 0))]
      if (pa === null) return [cmp('>=', token, at(M, mi, 0)), cmp('<', token, at(M, mi + 1, 0))]
      return [cmp('=', token, at(M, mi, pa, pre))]
    }
    case '^': {
      if (M === null) return anyVersion()
      if (mi === null) return [cmp('>=', token, at(M, 0, 0)), cmp('<', token, at(M + 1, 0, 0))]
      if (pa === null) {
        return M === 0
          ? [cmp('>=', token, at(0, mi, 0)), cmp('<', token, at(0, mi + 1, 0))]
          : [cmp('>=', token, at(M, mi, 0)), cmp('<', token, at(M + 1, 0, 0))]
      }
      const lower = cmp('>=', token, at(M, mi, pa, pre))
      if (M > 0) return [lower, cmp('<', token, at(M + 1, 0, 0))]
      if (mi > 0) return [lower, cmp('<', token, at(0, mi + 1, 0))]
      return [lower, cmp('<', token, at(0, 0, pa + 1))]
    }
    case '~': {
      if (M === null) return anyVersion()
      if (mi === null) return [cmp('>=', token, at(M, 0, 0)), cmp('<', token, at(M + 1, 0, 0))]
      if (pa === null) return [cmp('>=', token, at(M, mi, 0)), cmp('<', token, at(M, mi + 1, 0))]
      return [cmp('>=', token, at(M, mi, pa, pre)), cmp('<', token, at(M, mi + 1, 0))]
    }
    case '>': {
      if (M === null) return nothing()
      if (mi === null) return [cmp('>=', token, at(M + 1, 0, 0))]
      if (pa === null) return [cmp('>=', token, at(M, mi + 1, 0))]
      return [cmp('>', token, at(M, mi, pa, pre))]
    }
    case '>=': {
      if (M === null) return anyVersion()
      if (mi === null) return [cmp('>=', token, at(M, 0, 0))]
      if (pa === null) return [cmp('>=', token, at(M, mi, 0))]
      return [cmp('>=', token, at(M, mi, pa, pre))]
    }
    case '<': {
      if (M === null) return nothing()
      if (mi === null) return [cmp('<', token, at(M, 0, 0))]
      if (pa === null) return [cmp('<', token, at(M, mi, 0))]
      return [cmp('<', token, at(M, mi, pa, pre))]
    }
    case '<=': {
      if (M === null) return anyVersion()
      if (mi === null) return [cmp('<', token, at(M + 1, 0, 0))]
      if (pa === null) return [cmp('<', token, at(M, mi + 1, 0))]
      return [cmp('<=', token, at(M, mi, pa, pre))]
    }
    default:
      throw new Error(`unsupported range operator: "${op}"`)
  }
}

/** Parse a range into an OR-list of AND-sets of comparators. */
export function parseRange(range: string): Comparator[][] {
  const text = String(range ?? '').trim()
  if (text === '') return [[cmp('>=', '*', ZERO())]]
  return text.split('||').map((chunk) => {
    // glue an operator to the version that follows it: ">= 1.2.3" -> ">=1.2.3"
    const normalised = chunk.trim().replace(/(<=|>=|<|>|=|\^|~>|~)\s+/g, '$1')
    if (normalised === '' || normalised === '*') return [cmp('>=', '*', ZERO())]
    const hyphen = /^(\S+)\s+-\s+(\S+)$/.exec(normalised)
    if (hyphen) {
      const lo = expandComparator(`>=${hyphen[1]}`)
      const hi = expandComparator(`<=${hyphen[2]}`)
      return [...lo, ...hi]
    }
    const out: Comparator[] = []
    for (const token of normalised.split(/\s+/).filter(Boolean)) out.push(...expandComparator(token))
    return out
  })
}

const testComparator = (v: Parsed, c: Comparator): boolean => {
  const r = compareVersions(v, c.v)
  switch (c.op) {
    case '>':
      return r > 0
    case '>=':
      return r >= 0
    case '<':
      return r < 0
    case '<=':
      return r <= 0
    default:
      return r === 0
  }
}

/** Does `version` satisfy `range`? Prereleases only match sets that name the same M.m.p. */
export function satisfies(v: Parsed, range: string): boolean {
  return parseRange(range).some((set) => {
    for (const c of set) if (!testComparator(v, c)) return false
    if (v.prerelease.length) {
      return set.some(
        (c) =>
          c.v.prerelease.length &&
          c.v.major === v.major &&
          c.v.minor === v.minor &&
          c.v.patch === v.patch
      )
    }
    return true
  })
}

// ---------------------------------------------------------------------------
// increment
// ---------------------------------------------------------------------------

const bumpPrerelease = (pre: Ident[], identifier: string): Ident[] => {
  let next = pre.slice()
  if (next.length === 0) {
    next = [0]
  } else {
    let i = next.length
    let bumped = false
    while (--i >= 0) {
      if (typeof next[i] === 'number') {
        next[i] = (next[i] as number) + 1
        bumped = true
        break
      }
    }
    if (!bumped) next.push(0)
  }
  if (identifier) {
    if (next[0] === identifier) {
      if (typeof next[1] !== 'number') next = [identifier, 0]
    } else {
      next = [identifier, 0]
    }
  }
  return next
}

/** Bump a version the way `npm version <release>` does. */
export function increment(p: Parsed, release: string, identifier = ''): string {
  const major = p.major
  const minor = p.minor
  const patch = p.patch
  const pre = p.prerelease
  switch (release) {
    case 'major':
      return formatVersion({
        major: minor === 0 && patch === 0 && pre.length ? major : major + 1,
        minor: 0,
        patch: 0,
        prerelease: []
      })
    case 'minor':
      return formatVersion({
        major,
        minor: patch === 0 && pre.length ? minor : minor + 1,
        patch: 0,
        prerelease: []
      })
    case 'patch':
      return formatVersion({ major, minor, patch: pre.length ? patch : patch + 1, prerelease: [] })
    case 'premajor':
      return formatVersion({
        major: major + 1,
        minor: 0,
        patch: 0,
        prerelease: bumpPrerelease([], identifier)
      })
    case 'preminor':
      return formatVersion({
        major,
        minor: minor + 1,
        patch: 0,
        prerelease: bumpPrerelease([], identifier)
      })
    case 'prepatch':
      return formatVersion({
        major,
        minor,
        patch: patch + 1,
        prerelease: bumpPrerelease([], identifier)
      })
    case 'prerelease': {
      if (!pre.length) {
        return formatVersion({
          major,
          minor,
          patch: patch + 1,
          prerelease: bumpPrerelease([], identifier)
        })
      }
      return formatVersion({ major, minor, patch, prerelease: bumpPrerelease(pre, identifier) })
    }
    default:
      throw new Error(`unknown release type: "${release}"`)
  }
}

// ---------------------------------------------------------------------------
// utility
// ---------------------------------------------------------------------------

const describe = (p: Parsed) => ({
  raw: p.raw,
  version: p.version,
  valid: true,
  major: p.major,
  minor: p.minor,
  patch: p.patch,
  prerelease: p.prerelease,
  build: p.build,
  isPrerelease: p.prerelease.length > 0,
  isStable: p.prerelease.length === 0 && p.major > 0
})

const linesOf = (s: string) =>
  s
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)

/**
 * Wrap a per-line result set for the pipeline.
 *
 * A bare array must NEVER be returned: the runner's `valueType()` classifies arrays as
 * 'string', so an array output is rendered with `String(value)` — i.e. the user sees
 * "[object Object],[object Object]" instead of pretty-printed JSON. One line keeps the
 * flat object; several lines are boxed in a plain object.
 */
const asJson = <T>(items: T[]): Record<string, unknown> =>
  items.length === 1
    ? (items[0] as unknown as Record<string, unknown>)
    : { count: items.length, results: items }

const util: Utility = {
  id: 'semver',
  name: 'semver',
  category: 'Web & Dev',
  description:
    'Parse, validate, compare, sort, range-check (satisfies) or increment SemVer 2.0.0 versions, with full prerelease precedence.',
  accepts: 'string',
  produces: ['string', 'json'],
  tags: ['version', 'semantic versioning', 'npm version', 'compare versions', 'version range', 'versioning'],
  aliases: ['semver.satisfies', 'semver.compare'],
  examples: [
    {
      title: 'parse a version with prerelease and build',
      input: '1.2.3-beta.1+build.5',
      params: { mode: 'parse' },
      output:
        '{\n  "raw": "1.2.3-beta.1+build.5",\n  "version": "1.2.3-beta.1",\n  "valid": true,\n  "major": 1,\n  "minor": 2,\n  "patch": 3,\n  "prerelease": [\n    "beta",\n    1\n  ],\n  "build": [\n    "build",\n    "5"\n  ],\n  "isPrerelease": true,\n  "isStable": false\n}'
    },
    {
      title: 'compare two versions',
      input: '1.2.3',
      params: { mode: 'compare', other: '1.3.0' },
      output:
        '{\n  "a": "1.2.3",\n  "b": "1.3.0",\n  "result": -1,\n  "relation": "lt",\n  "description": "1.2.3 < 1.3.0",\n  "equalPrecedence": false\n}'
    },
    {
      title: 'test against a caret range',
      input: '1.4.2',
      params: { mode: 'satisfies', range: '^1.2.0' },
      output: '{\n  "version": "1.4.2",\n  "range": "^1.2.0",\n  "satisfies": true\n}'
    }
  ],
  params: {
    mode: {
      kind: 'select',
      label: 'mode',
      options: ['parse', 'validate', 'compare', 'sort', 'satisfies', 'increment'],
      default: 'parse'
    },
    other: {
      kind: 'string',
      label: 'other version (compare) / prerelease id (increment)',
      default: '',
      placeholder: '1.4.0'
    },
    range: { kind: 'string', label: 'range (satisfies)', default: '', placeholder: '^1.2.0 || >=2' },
    release: {
      kind: 'select',
      label: 'release (increment)',
      options: ['major', 'minor', 'patch', 'premajor', 'preminor', 'prepatch', 'prerelease'],
      default: 'patch'
    },
    direction: { kind: 'select', label: 'direction (sort)', options: ['asc', 'desc'], default: 'asc' }
  },
  apply: (input: any, params: any = {}) => {
    const text = String(input ?? '')
    const mode = String(params.mode || 'parse')
    const other = String(params.other ?? '').trim()
    const range = String(params.range ?? '')
    const release = String(params.release || 'patch')
    const direction = String(params.direction || 'asc')
    const lines = linesOf(text)

    if (!lines.length) {
      return mode === 'sort' || mode === 'increment' ? '' : {}
    }

    switch (mode) {
      case 'parse':
        return asJson(lines.map((l) => describe(mustParse(l))))

      case 'validate':
        return asJson(
          lines.map((l) => {
            const p = parseVersion(l)
            return p
              ? { version: l, valid: true, normalized: p.version, reason: '' }
              : { version: l, valid: false, normalized: '', reason: 'does not match major.minor.patch[-prerelease][+build]' }
          })
        )

      case 'compare': {
        if (!other) throw new Error('compare mode needs a version in the "other version" param')
        const a = mustParse(lines[0])
        const b = mustParse(other, 'version (other)')
        const result = compareVersions(a, b)
        const relation = result < 0 ? 'lt' : result > 0 ? 'gt' : 'eq'
        const symbol = result < 0 ? '<' : result > 0 ? '>' : '=='
        return {
          a: a.version,
          b: b.version,
          result,
          relation,
          description: `${a.version} ${symbol} ${b.version}`,
          equalPrecedence: result === 0
        }
      }

      case 'sort': {
        const parsed = lines.map((l) => {
          const p = parseVersion(l)
          if (!p) throw new Error(`not a valid semver version: "${l}"`)
          return p
        })
        parsed.sort((a, b) => compareVersions(a, b) || (a.raw < b.raw ? -1 : a.raw > b.raw ? 1 : 0))
        if (direction === 'desc') parsed.reverse()
        return parsed.map((p) => p.raw).join('\n')
      }

      case 'satisfies': {
        const effective = range.trim() || '*'
        // parse the range once so a bad range throws before we test anything
        parseRange(effective)
        return asJson(
          lines.map((l) => {
            const p = mustParse(l)
            return { version: p.version, range: effective, satisfies: satisfies(p, effective) }
          })
        )
      }

      case 'increment':
        return lines.map((l) => increment(mustParse(l), release, other)).join('\n')

      default:
        throw new Error(`unknown mode: "${mode}"`)
    }
  }
}

export default util
