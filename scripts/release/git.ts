import { execFileSync } from 'node:child_process'
import type { ChangeSet } from './changes'

/** git's well-known empty tree: the "before" side of a repository's first commit. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

/** A repository's git CLI. Arguments are passed as an argv array (no shell). */
export class Git {
  constructor(readonly cwd: string) {}

  run(args: readonly string[]): string {
    return execFileSync('git', args, { cwd: this.cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
  }

  /** `null` instead of an exception when git exits non-zero. */
  tryRun(args: readonly string[]): string | null {
    try {
      return this.run(args)
    } catch {
      return null
    }
  }

  revParse(rev: string): string {
    return this.run(['rev-parse', '--verify', `${rev}^{commit}`]).trim()
  }

  isAncestor(ancestor: string, descendant: string): boolean {
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { cwd: this.cwd, stdio: 'ignore' })
      return true
    } catch (err) {
      if ((err as { status?: number }).status === 1) return false
      throw err
    }
  }

  /** The newest tag matching `pattern` (a git glob) reachable from `rev`, or `null`. */
  nearestTag(pattern: string, rev = 'HEAD'): string | null {
    return this.tryRun(['describe', '--tags', '--abbrev=0', '--match', pattern, rev])?.trim() || null
  }

  /** Every tag matching `pattern` (a git glob). */
  tags(pattern: string): string[] {
    return lines(this.run(['tag', '--list', pattern]))
  }

  /**
   * Commits on `to`'s first-parent line after `from` (all of them for `null`), newest first: one per
   * merged pull request. With `paths`, only the commits that changed one of them.
   */
  firstParentCommits(from: string | null, to = 'HEAD', paths: readonly string[] = []): string[] {
    const range = from ? `${from}..${to}` : to
    return lines(this.run(['rev-list', '--first-parent', range, ...(paths.length ? ['--', ...paths] : [])]))
  }

  /** Every commit reachable from `to` but not from `from`. */
  commitsBetween(from: string, to = 'HEAD'): string[] {
    return lines(this.run(['rev-list', `${from}..${to}`]))
  }

  subject(rev: string): string {
    return this.run(['log', '-1', '--format=%s', rev]).trim()
  }

  /** File contents at `rev`, or `null` when the file doesn't exist there. */
  show(rev: string, path: string): string | null {
    return this.tryRun(['show', `${rev}:${path}`])
  }

  /** What changed from `from` to `to`. */
  diff(from: string, to: string): ChangeSet {
    const out = this.run(['diff', '--name-only', '--no-renames', '-z', from, to])
    const files = out.split('\0').filter(Boolean)
    return { files, before: path => this.show(from, path), after: path => this.show(to, path) }
  }

  /** What commit `rev` changed relative to its first parent (a merge commit: the whole merged branch). */
  commitDiff(rev: string): ChangeSet {
    const parent = this.tryRun(['rev-parse', '--verify', '--quiet', `${rev}^1`])?.trim()
    return this.diff(parent || EMPTY_TREE, rev)
  }
}

function lines(text: string): string[] {
  return text.split('\n').map(l => l.trim()).filter(Boolean)
}
