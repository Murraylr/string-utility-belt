import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { newest, parseGitLog, readSourceDates } from './lastmod'

const FALLBACK = '1999-12-31'

describe('newest', () => {
  it('picks the latest date and skips missing ones', () => {
    expect(newest(['2026-01-02', undefined, '2026-03-01', '2025-12-31'])).toBe('2026-03-01')
    expect(newest([undefined])).toBeUndefined()
    expect(newest([])).toBeUndefined()
  })
})

describe('parseGitLog', () => {
  // `git log -z --name-only --format=%x01%cI`: newest commit first
  const log = (...commits: Array<[string, string[]]>) =>
    commits.map(([date, files]) => `\x01${date}\0\n${files.map(f => `${f}\0`).join('')}`).join('')

  it('dates each file and every directory above it by its newest commit, in UTC', () => {
    const dates = parseGitLog(log(
      // 22:30 in New York is the next day in UTC
      ['2026-03-01T22:30:00-04:00', ['src/utilities/trim/guide.md']],
      ['2026-02-01T09:00:00+00:00', ['src/utilities/trim/index.ts', 'src/utilities/case/index.ts']],
    ))
    expect(dates.get('src/utilities/trim/guide.md')).toBe('2026-03-02')
    expect(dates.get('src/utilities/trim/index.ts')).toBe('2026-02-01')
    expect(dates.get('src/utilities/trim')).toBe('2026-03-02')
    expect(dates.get('src/utilities/case')).toBe('2026-02-01')
    expect(dates.get('src/utilities')).toBe('2026-03-02')
    expect(dates.get('src')).toBe('2026-03-02')
  })

  it('keeps the newest date when committer dates are out of order', () => {
    const dates = parseGitLog(log(
      ['2026-01-01T00:00:00Z', ['a/x.md']],
      ['2026-05-05T00:00:00Z', ['a/x.md', 'a/y.md']],
    ))
    expect(dates.get('a/x.md')).toBe('2026-05-05')
    expect(dates.get('a')).toBe('2026-05-05')
  })

  it('ignores tests and snapshots: they never reach a page', () => {
    const dates = parseGitLog(log(
      ['2026-09-09T00:00:00Z', ['src/utilities/trim/index.test.ts', 'src/utilities/trim/__snapshots__/x.snap']],
      ['2026-01-01T00:00:00Z', ['src/utilities/trim/index.ts']],
    ))
    expect(dates.get('src/utilities/trim')).toBe('2026-01-01')
    expect(dates.has('src/utilities/trim/index.test.ts')).toBe(false)
  })

  it('skips files under a commit whose date does not parse, and reads nothing from empty output', () => {
    expect([...parseGitLog(log(['not a date', ['a.md']], ['2026-01-01T00:00:00Z', ['b.md']]))]).toEqual([['b.md', '2026-01-01']])
    expect(parseGitLog('').size).toBe(0)
  })
})

describe('readSourceDates', () => {
  const dirs: string[] = []
  const tmp = (prefix: string) => {
    const dir = mkdtempSync(path.join(os.tmpdir(), prefix))
    dirs.push(dir)
    return dir
  }
  // isolated from the machine's git config (signing, hooks, default branch)
  const git = (cwd: string, args: string[], date = '2026-01-01T12:00:00Z') => execFileSync('git', [
    '-c', 'user.name=Test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args,
  ], { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date, GIT_CONFIG_NOSYSTEM: '1' } })
  const write = (repo: string, file: string, text: string) => {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
    writeFileSync(path.join(repo, file), text)
  }
  const commit = (repo: string, date: string, files: Record<string, string>, message = 'change') => {
    for (const [file, text] of Object.entries(files)) write(repo, file, text)
    git(repo, ['add', '-A'])
    git(repo, ['commit', '-q', '-m', message], date)
  }

  let repo: string
  beforeAll(() => {
    repo = tmp('lastmod-repo-')
    git(repo, ['init', '-q', '-b', 'main'])
    commit(repo, '2026-01-01T12:00:00Z', {
      'src/utilities/trim/index.ts': 'v1', 'src/utilities/trim/guide.md': 'v1', 'src/utilities/case/index.ts': 'v1', 'CHANGELOG.md': 'v1',
    })
    // written on a branch on the 5th, merged on the 10th
    git(repo, ['checkout', '-q', '-b', 'feature'])
    commit(repo, '2026-01-05T12:00:00Z', { 'src/utilities/trim/guide.md': 'v2' })
    git(repo, ['checkout', '-q', 'main'])
    commit(repo, '2026-01-07T12:00:00Z', { 'CHANGELOG.md': 'v2' })
    git(repo, ['merge', '-q', '--no-ff', '-m', 'Merge feature', 'feature'], '2026-01-10T12:00:00Z')
    // a test-only change after that
    commit(repo, '2026-02-01T12:00:00Z', { 'src/utilities/case/index.test.ts': 'test' })
  })

  afterAll(() => {
    for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  })

  it('dates a merged change by the day it landed on the main line, files and directories alike', () => {
    const logs: string[] = []
    const dates = readSourceDates(repo, { fallback: FALLBACK, log: m => logs.push(m) })
    expect(dates(['src/utilities/trim/guide.md'])).toBe('2026-01-10')
    expect(dates(['src/utilities/trim'])).toBe('2026-01-10')
    expect(dates(['src/utilities/trim/'])).toBe('2026-01-10')
    expect(dates(['./src/utilities/trim/index.ts'])).toBe('2026-01-01')
    expect(dates(['CHANGELOG.md'])).toBe('2026-01-07')
    expect(logs).toEqual([])
  })

  it('takes the newest of several paths, ignores test-only commits and has no date for untracked paths', () => {
    const dates = readSourceDates(repo, { fallback: FALLBACK })
    expect(dates(['src/utilities/case'])).toBe('2026-01-01')
    expect(dates(['src/utilities/case', 'CHANGELOG.md'])).toBe('2026-01-07')
    expect(dates(['src/utilities/nope'])).toBeUndefined()
  })

  it('gives every path HEAD\'s date in a shallow clone — its oldest commit lists every file as added', () => {
    const shallow = path.join(tmp('lastmod-shallow-'), 'clone')
    execFileSync('git', ['clone', '-q', '--depth', '1', `file://${repo}`, shallow])
    const logs: string[] = []
    const dates = readSourceDates(shallow, { fallback: FALLBACK, log: m => logs.push(m) })
    expect(dates(['src/utilities/trim'])).toBe('2026-02-01')
    expect(dates(['CHANGELOG.md'])).toBe('2026-02-01')
    expect(dates(['src/utilities/nope'])).toBe('2026-02-01')
    expect(logs).toEqual([expect.stringMatching(/shallow git clone .* HEAD's commit date \(2026-02-01\)/)])
  })

  it('gives every path the fallback outside a git repository', () => {
    const logs: string[] = []
    const dates = readSourceDates(tmp('lastmod-nogit-'), { fallback: FALLBACK, log: m => logs.push(m) })
    expect(dates(['anything'])).toBe(FALLBACK)
    expect(logs).toEqual([expect.stringMatching(/no git history .* is 1999-12-31/)])
  })
})
