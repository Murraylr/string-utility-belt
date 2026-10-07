// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Git } from './git'
import {
  applyPlan, lastNonReleaseCommit, levelFromLabels, planRelease, planSummary, releaseCommitMessage, supersededReason,
  type TargetPlan,
} from './plan'
import type { Target } from './targets'

const TARGETS: Target[] = [
  {
    id: 'app', title: 'App', trigger: 'auto', include: ['src/**', 'CHANGELOG.md'], exclude: ['**/*.test.ts'],
    rootManifest: 'all', entries: [],
    versionFiles: [{ path: 'package.json', pointer: ['version'] }], changelog: 'CHANGELOG.md',
  },
  {
    id: 'cli', title: 'CLI', trigger: 'auto', include: ['src/core/**', 'packages/cli/**'], exclude: ['**/*.test.ts'],
    rootManifest: 'bundled', entries: ['packages/cli/main.ts'],
    versionFiles: [
      { path: 'packages/cli/package.json', pointer: ['version'] },
      { path: 'packages/cli/manifest.json', pointer: ['meta', 'version'] },
    ],
  },
  {
    id: 'extension', title: 'Extension', trigger: 'manual', include: ['src/core/**', 'packages/extension/**'], exclude: [],
    rootManifest: 'bundled', entries: ['packages/extension/main.ts'],
    versionFiles: [{ path: 'packages/extension/manifest.json', pointer: ['version'] }],
  },
]

let dir: string
let git: Git
/** Pull request labels by commit, as the GitHub API would report them. */
let labels: Map<string, string[]>

const sh = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim()
const write = (file: string, content: string) => {
  mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
  writeFileSync(path.join(dir, file), content)
}
const read = (file: string) => readFileSync(path.join(dir, file), 'utf8')
const commit = (message: string, files: Record<string, string>, prLabels: string[] = []) => {
  for (const [file, content] of Object.entries(files)) write(file, content)
  sh('add', '-A')
  sh('commit', '-q', '-m', message)
  const sha = sh('rev-parse', 'HEAD')
  labels.set(sha, prLabels)
  return sha
}
const versions = (app: string, cli: string) => ({
  'package.json': `{\n  "name": "app",\n  "version": "${app}"\n}\n`,
  'packages/cli/package.json': `{\n  "name": "cli",\n  "version": "${cli}"\n}\n`,
  'packages/cli/manifest.json': `{ "meta": { "version": "${cli}" }, "list": ["a", "b"] }\n`,
})
const lockfile = (packages: Record<string, string>) => `${JSON.stringify({
  name: 'app', lockfileVersion: 3,
  packages: Object.fromEntries(Object.entries(packages).map(([name, version]) => [`node_modules/${name}`, { version }])),
}, null, 2)}\n`
const plan = (tested?: string, manual: string[] = []) => planRelease({
  targets: TARGETS, git, root: dir, tested, labels: async sha => labels.get(sha) ?? [], manual: new Set(manual as Target['id'][]),
})
const byId = (plans: TargetPlan[]) => Object.fromEntries(plans.map(p => [p.id, p]))
/** What the release workflow does after deploying: tag each released target on HEAD. */
const tagReleased = (plans: TargetPlan[]) => plans.filter(p => p.release).forEach(p => sh('tag', `${p.id}-v${p.next}`))
/** What the release job does with a plan: apply it and commit the result. */
const releaseCommit = (plans: TargetPlan[]) => {
  applyPlan(dir, TARGETS, plans, '2026-10-07')
  sh('commit', '-q', '-am', releaseCommitMessage(plans))
  return sh('rev-parse', 'HEAD')
}

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'release-plan-'))
  sh('init', '-q', '-b', 'main')
  sh('config', 'user.name', 'Test')
  sh('config', 'user.email', 'test@example.com')
  sh('config', 'commit.gpgsign', 'false')
  sh('config', 'tag.gpgsign', 'false')
  git = new Git(dir)
  labels = new Map()
  commit('initial', {
    ...versions('1.0.0', '2.0.0'),
    'src/app.ts': 'app\n',
    'src/core/engine.ts': 'engine\n',
    'packages/cli/main.ts': "import { parse } from 'yaml'\nimport '../../src/core/engine'\n",
    'packages/extension/main.ts': "import '../../src/core/engine'\n",
    'packages/extension/manifest.json': '{ "version": "1.4.0" }\n',
    'package-lock.json': lockfile({ yaml: '2.8.0', react: '18.2.0' }),
    'CHANGELOG.md': '# Changelog\n\n## [Unreleased]\n\n## [1.0.0] - 2026-01-01\n\n- First.\n',
  })
})

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('planRelease', () => {
  it('releases every target on its first run, with a bump: a store may hold the current version already', async () => {
    const plans = byId(await plan())
    expect(plans.app).toMatchObject({ release: true, previous: null, current: '1.0.0', next: '1.0.1', bump: 'patch' })
    expect(plans.cli).toMatchObject({ release: true, previous: null, current: '2.0.0', next: '2.0.1', bump: 'patch' })
    expect(plans.app.reason).toMatch(/no app-v\* tag/)
    expect(plans.extension).toMatchObject({ release: false, waiting: true, next: '1.4.0', bump: null })
    expect(plans.extension.reason).toMatch(/^waiting for a manual release \(would be 1\.4\.1: first tagged release/)
  })

  it('does not bump twice when a first release is retried after its bump commit was pushed', async () => {
    const tested = sh('rev-parse', 'HEAD')
    releaseCommit(await plan(tested))
    const retry = byId(await plan(tested))
    expect(retry.app).toMatchObject({ release: true, current: '1.0.1', next: '1.0.1', bump: null })
    expect(retry.cli).toMatchObject({ release: true, current: '2.0.1', next: '2.0.1', bump: null })
  })

  it('releases nothing that is unchanged since its tag', async () => {
    const first = await plan()
    releaseCommit(first)
    tagReleased(first)
    commit('docs', { 'README.md': 'readme\n', 'src/core/engine.test.ts': 'test\n' })
    const plans = byId(await plan())
    expect(plans.app).toMatchObject({ release: false, reason: 'unchanged since app-v1.0.1' })
    expect(plans.cli).toMatchObject({ release: false, reason: 'unchanged since cli-v2.0.1' })
  })

  it('releases only the targets a change ships in, at the level of the labels on the pull requests that touched them', async () => {
    const first = await plan()
    releaseCommit(first)
    tagReleased(first)
    commit('app feature', { 'src/app.ts': 'app 2\n' }, ['release:major'])
    commit('cli fix', { 'packages/cli/main.ts': 'cli 2\n' }, ['bug', 'release:minor'])
    const plans = byId(await plan())
    expect(plans.app).toMatchObject({ release: true, next: '2.0.0', bump: 'major', changes: ['src/app.ts'] })
    expect(plans.cli).toMatchObject({ release: true, next: '2.1.0', bump: 'minor', changes: ['packages/cli/main.ts'] })
  })

  it('bumps every target that shares a changed file', async () => {
    const first = await plan()
    releaseCommit(first)
    tagReleased(first)
    commit('engine', { 'src/core/engine.ts': 'engine 2\n' })
    const plans = byId(await plan())
    expect(plans.app).toMatchObject({ release: true, next: '1.0.2', bump: 'patch' })
    expect(plans.cli).toMatchObject({ release: true, next: '2.0.2', bump: 'patch' })
  })

  it('keeps a version a pull request already raised', async () => {
    const first = await plan()
    releaseCommit(first)
    tagReleased(first)
    commit('cli 3', { ...versions('1.0.1', '3.0.0'), 'packages/cli/main.ts': 'cli 3\n' }, ['release:minor'])
    const plans = byId(await plan())
    expect(plans.cli).toMatchObject({ release: true, previous: '2.0.1', next: '3.0.0', bump: null, reason: 'version already raised from 2.0.1' })
    expect(plans.app.release).toBe(false)
  })

  it('bumps a raised version again when the target changed after the version was set', async () => {
    const first = await plan()
    releaseCommit(first)
    tagReleased(first)
    // a release run bumps cli to 2.0.2 and pushes that, but its deploy fails: no cli-v2.0.2 tag
    commit('cli fix', { 'packages/cli/main.ts': 'cli 2\n' })
    releaseCommit((await plan()).filter(p => p.id === 'cli'))
    // before anyone retries, another cli change is merged: 2.0.2 may be on npm with the older content
    commit('cli feature', { 'packages/cli/main.ts': 'cli 3\n' }, ['release:minor'])
    expect(byId(await plan()).cli).toMatchObject({ release: true, previous: '2.0.1', current: '2.0.2', next: '2.1.0', bump: 'minor' })
  })

  it('releases a raised version as it is when nothing it ships changed after it was set', async () => {
    const first = await plan()
    releaseCommit(first)
    tagReleased(first)
    commit('cli fix', { 'packages/cli/main.ts': 'cli 2\n' })
    releaseCommit((await plan()).filter(p => p.id === 'cli'))
    commit('app only', { 'src/app.ts': 'app 2\n' })
    expect(byId(await plan()).cli).toMatchObject({ release: true, current: '2.0.2', next: '2.0.2', bump: null })
  })

  it('releases a package for a lockfile change only when the change is in what it bundles', async () => {
    const first = await plan()
    releaseCommit(first)
    tagReleased(first)
    commit('bump react', { 'package-lock.json': lockfile({ yaml: '2.8.0', react: '18.3.0' }) })
    let plans = byId(await plan())
    expect(plans.app).toMatchObject({ release: true, changes: ['package-lock.json (package: react)'] })
    expect(plans.cli).toMatchObject({ release: false })

    commit('bump yaml', { 'package-lock.json': lockfile({ yaml: '2.9.0', react: '18.3.0' }) })
    plans = byId(await plan())
    expect(plans.cli).toMatchObject({ release: true, next: '2.0.2', changes: ['package-lock.json (bundled package: yaml)'] })
  })

  it('holds a manual target\'s changes until a run asks for it', async () => {
    const first = await plan(undefined, ['extension'])
    expect(byId(first).extension).toMatchObject({ release: true, waiting: false, next: '1.4.1' })
    releaseCommit(first)
    tagReleased(first)

    commit('extension fix', { 'packages/extension/main.ts': "import '../../src/core/engine'\n// fix\n" }, ['release:minor'])
    const held = byId(await plan())
    expect(held.extension).toMatchObject({ release: false, waiting: true, current: '1.4.1', next: '1.4.1', bump: null })
    expect(held.extension.reason).toBe('waiting for a manual release (would be 1.5.0: changed since extension-v1.4.1)')
    expect(planSummary(Object.values(held), 'x')).toContain('| Extension | ⏸ manual | 1.4.1 |')
    expect(releaseCommitMessage(Object.values(held))).not.toContain('extension')

    expect(byId(await plan(undefined, ['extension'])).extension).toMatchObject({ release: true, next: '1.5.0', bump: 'minor' })
  })

    it('refuses version files that disagree, or that fall below the last release', async () => {
    const first = await plan()
    releaseCommit(first)
    tagReleased(first)
    commit('drift', { 'packages/cli/manifest.json': '{ "meta": { "version": "9.9.9" } }\n' })
    await expect(plan()).rejects.toThrow(/cli: version files disagree — packages\/cli\/package.json\["version"\] = 2\.0\.1, packages\/cli\/manifest.json\["meta"\]\["version"\] = 9\.9\.9/)
    commit('lower', versions('1.0.0', '2.0.1'))
    await expect(plan()).rejects.toThrow(/app: the version files say 1\.0\.0, lower than the last release app-v1\.0\.1/)
  })
})

describe('applyPlan', () => {
  it('writes the new version into every version file without reformatting, and promotes the changelog', async () => {
    write('CHANGELOG.md', '# Changelog\n\n## [Unreleased]\n\n- New thing.\n\n## [1.0.0] - 2026-01-01\n\n- First.\n')
    const changed = applyPlan(dir, TARGETS, await plan(), '2026-10-07')
    expect(changed.sort()).toEqual(['CHANGELOG.md', 'package.json', 'packages/cli/manifest.json', 'packages/cli/package.json'])
    expect(read('packages/cli/manifest.json')).toBe('{ "meta": { "version": "2.0.1" }, "list": ["a", "b"] }\n')
    expect(read('package.json')).toBe('{\n  "name": "app",\n  "version": "1.0.1"\n}\n')
    expect(read('CHANGELOG.md')).toBe('# Changelog\n\n## [Unreleased]\n\n## [1.0.1] - 2026-10-07\n\n- New thing.\n\n## [1.0.0] - 2026-01-01\n\n- First.\n')
  })

  it('leaves an empty [Unreleased] alone', async () => {
    const before = read('CHANGELOG.md')
    applyPlan(dir, TARGETS, await plan(), '2026-10-07')
    expect(read('CHANGELOG.md')).toBe(before)
  })
})

describe('tested commit checks', () => {
  it('accepts HEAD, and HEAD plus release commits', async () => {
    const tested = sh('rev-parse', 'HEAD')
    expect(supersededReason(git, tested)).toBeNull()
    releaseCommit(await plan())
    expect(supersededReason(git, tested)).toBeNull()
    expect(lastNonReleaseCommit(git)).toBe(tested)
  })

  it('stands down when main has moved past the tested commit', () => {
    const tested = sh('rev-parse', 'HEAD')
    commit('newer', { 'src/app.ts': 'newer\n' })
    expect(supersededReason(git, tested)).toMatch(/main has moved on/)
  })

  it('stands down when the tested commit is no longer on the branch', () => {
    sh('checkout', '-q', '-b', 'side')
    const sideCommit = commit('side', { 'src/app.ts': 'side\n' })
    sh('checkout', '-q', 'main')
    expect(supersededReason(git, sideCommit)).toMatch(/no longer on this branch/)
  })
})

describe('levelFromLabels / releaseCommitMessage / planSummary', () => {
  it('maps release labels to bump levels, ignoring case and other labels', () => {
    expect(levelFromLabels([])).toBeNull()
    expect(levelFromLabels(['bug'])).toBeNull()
    expect(levelFromLabels(['Release:Minor'])).toBe('minor')
    expect(levelFromLabels(['release:minor', 'release:major'])).toBe('major')
  })

  it('names every released target in a [skip ci] release commit', async () => {
    expect(releaseCommitMessage(await plan())).toBe('chore(release): app 1.0.1, cli 2.0.1 [skip ci]')
  })

  it('renders a table with the tags a run creates', async () => {
    const summary = planSummary(await plan(), 'Release plan')
    expect(summary).toContain('| App | 🚀 release | 1.0.0 → **1.0.1** (patch) |')
    expect(summary).toContain('Tags: `app-v1.0.1`, `cli-v2.0.1`')
  })
})
