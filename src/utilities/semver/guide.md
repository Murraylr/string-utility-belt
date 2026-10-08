---
title: Semantic Version Tool: Compare, Sort and Bump SemVer
description: Parse, validate, compare, sort, range-check and increment semantic versions online, with full SemVer 2.0.0 prerelease precedence rules.
---
## What is semantic versioning?

Semantic versioning (SemVer) is the `major.minor.patch` scheme most package ecosystems use (npm, Cargo, Composer and many more), with an optional prerelease suffix (`-beta.1`) and build metadata (`+build.5`). The rule of thumb is: bump `major` for breaking changes, `minor` for backward-compatible features, `patch` for bug fixes. This tool parses, validates, compares, sorts, range-checks and increments version strings against the official [SemVer 2.0.0](https://semver.org/) grammar, including its precise prerelease precedence rules.

## How it works

`parse` mode breaks a version into its parts:

```example
title: parse a version with prerelease and build metadata
input: 1.2.3-beta.1+build.5
params: {"mode": "parse"}
output:
{
  "raw": "1.2.3-beta.1+build.5",
  "version": "1.2.3-beta.1",
  "valid": true,
  "major": 1,
  "minor": 2,
  "patch": 3,
  "prerelease": [
    "beta",
    1
  ],
  "build": [
    "build",
    "5"
  ],
  "isPrerelease": true,
  "isStable": false
}
```

A leading `v` (as in `v2.0.0`, a common Git tag convention) is stripped before parsing but kept in `raw`. Build metadata is parsed but never affects ordering (`1.0.0+a` and `1.0.0+b` compare as equal), which is exactly what the spec requires.

`compare` mode ranks two versions by SemVer precedence: major, then minor, then patch, then prerelease identifiers (a version *with* a prerelease always ranks below the same version without one):

```example
title: compare two versions
input: 1.2.3
params: {"mode": "compare", "other": "1.3.0"}
output:
{
  "a": "1.2.3",
  "b": "1.3.0",
  "result": -1,
  "relation": "lt",
  "description": "1.2.3 < 1.3.0",
  "equalPrecedence": false
}
```

`sort` mode orders a list of versions (one per line) by that same precedence, ascending by default:

```example
title: sort versions by precedence
input: 2.0.0
1.0.0-alpha
1.0.0
params: {"mode": "sort"}
output: 1.0.0-alpha
1.0.0
2.0.0
```

`satisfies` mode checks a version against a range using npm's range syntax: caret (`^1.2.0`, compatible within the same major version; below `1.0.0` it pins the minor version, and below `0.1.0` the patch), tilde (`~1.2.3`, compatible within the same minor version), plain comparisons, `x`/`*` wildcards, hyphen ranges, and `||` for "or":

```example
title: test against a caret range
input: 1.4.2
params: {"mode": "satisfies", "range": "^1.2.0"}
output:
{
  "version": "1.4.2",
  "range": "^1.2.0",
  "satisfies": true
}
```

`increment` mode bumps a version the way `npm version <release>` does: `major`, `minor`, `patch`, or their `pre-` variants that also attach a prerelease identifier:

```example
title: bump the minor version
input: 1.2.3
params: {"mode": "increment", "release": "minor"}
output: 1.3.0
```

`validate` mode checks a version's shape without throwing, which is useful for filtering a list of possibly-invalid strings. Notably, SemVer identifiers are restricted to ASCII letters, digits and hyphens, so accented or emoji characters make a version invalid even though they're valid Unicode text:

```example
title: validate reports invalid versions instead of throwing
input: 1.2.3-café
params: {"mode": "validate"}
output:
{
  "version": "1.2.3-café",
  "valid": false,
  "normalized": "",
  "reason": "does not match major.minor.patch[-prerelease][+build]"
}
```

## Options

- **mode**: `parse` (default), `validate`, `compare`, `sort`, `satisfies` or `increment`.
- **other version (compare) / prerelease id (increment)**: the second version to compare against in `compare` mode, or the prerelease identifier (`beta`, `rc`, …) to attach in `increment` mode.
- **range (satisfies)**: the range expression to test against in `satisfies` mode; an empty range means `*`, which matches every version except prereleases.
- **release (increment)**: `major`, `minor`, `patch` (default), `premajor`, `preminor`, `prepatch` or `prerelease`.
- **direction (sort)**: `asc` (default) or `desc`.

`parse`, `validate` and `satisfies` accept multiple lines and return one result per line. A single line gives that result directly, several lines are wrapped as `{ count, results }`. `sort` and `increment` return one version per line.

## Common uses

- Checking whether a dependency version satisfies a `package.json` range before upgrading.
- Sorting a list of Git tags or release versions into true precedence order (which is not the same as sorting them as plain strings).
- Working out the next version number for a release given the kind of change it contains.
- Validating user-supplied version strings in a form or CLI argument.

## Tips and pitfalls

- A prerelease version only satisfies a range that explicitly names the *same* `major.minor.patch` with its own prerelease bound. `1.2.3-beta.1` never satisfies `^1.0.0` even though `1.2.3` would, which matches npm's own range semantics and avoids accidentally installing an unstable release.
- `increment` on a prerelease version behaves like npm: bumping `major` on `1.0.0-alpha.1` yields plain `1.0.0`, since the prerelease already implies the major bump is coming.
- Malformed input throws in `parse`, `sort`, `compare`, `satisfies` and `increment`, but never in `validate`, which is designed to report bad input rather than stop on it.
- Versions are matched against the official regular expression published at [semver.org](https://semver.org/), after stripping a leading `v` or `=`. Partial versions such as `1.2` are therefore rejected everywhere except inside a `satisfies` range, where `1.2` means `1.2.x`.
