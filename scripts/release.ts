/**
 * Release tooling for `.github/workflows/release.yml` (see RELEASING.md).
 *
 *   npm run release -- plan [--tested <sha>|auto] [--apply] [--labels <a,b>]
 *       Which targets changed since their last `<id>-v<version>` tag, and the version each
 *       releases. `--tested` refuses to release anything but a CI-verified commit (`auto`: the
 *       newest non-release commit of HEAD, checked against the GitHub API). `--apply` writes the
 *       version bumps and changelog promotion into the working tree. `--labels` stands in for the
 *       merged pull requests' labels (the pull request preview). Read-only and safe to run locally.
 *
 *   npm run release -- published <target>
 *       Whether the target's current version is already on each of its stores, as step outputs
 *       (`npm`, `mcp_registry`, `vscode_marketplace`, `open_vsx` = true | false).
 *
 *   npm run release -- chrome-web-store <zip>
 *       Uploads the extension package and submits it for review (CWS_ACCESS_TOKEN, CWS_PUBLISHER_ID).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STORE_EXTENSION_ID } from '../src/core/extensionBridge'
import { publishToChromeWebStore } from './release/chrome-web-store'
import { Git } from './release/git'
import { GitHub, annotate, appendSummary, setOutput } from './release/github'
import {
  applyPlan, lastNonReleaseCommit, planRelease, planSummary, readTargetVersion, releaseCommitMessage, supersededReason,
} from './release/plan'
import { isPublished, storeName, type Store } from './release/stores'
import { TARGETS, targetById, type TargetId } from './release/targets'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** The stores `published` checks, and the manifest each one's package name comes from. */
const STORES: Partial<Record<TargetId, { store: Store; manifest: string }[]>> = {
  core: [{ store: 'npm', manifest: 'packages/core/package.json' }],
  cli: [{ store: 'npm', manifest: 'packages/cli/package.json' }],
  mcp: [
    { store: 'npm', manifest: 'packages/mcp/package.json' },
    { store: 'mcp-registry', manifest: 'server.json' },
  ],
  vscode: [
    { store: 'vscode-marketplace', manifest: 'packages/vscode/package.json' },
    { store: 'open-vsx', manifest: 'packages/vscode/package.json' },
  ],
}

interface Flags { values: Map<string, string>; switches: Set<string>; positional: string[] }

function parseFlags(args: string[], withValue: readonly string[]): Flags {
  const flags: Flags = { values: new Map(), switches: new Set(), positional: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (!arg.startsWith('--')) flags.positional.push(arg)
    else if (withValue.includes(arg)) {
      if (i + 1 >= args.length) throw new Error(`${arg} needs a value`)
      flags.values.set(arg, args[++i])
    } else flags.switches.add(arg)
  }
  return flags
}

/**
 * The commit CI verified, or `null` when a newer run supersedes this one. `auto`
 * (a manual run) takes the newest non-release commit and asks GitHub whether CI passed on it.
 */
async function resolveTested(git: Git, tested: string, github: GitHub | null): Promise<string | null> {
  if (tested === 'auto') {
    tested = lastNonReleaseCommit(git)
    if (!github) throw new Error('--tested auto needs GITHUB_TOKEN and GITHUB_REPOSITORY to confirm CI passed')
    if (!(await github.ciSucceeded(tested))) {
      throw new Error(`CI has not succeeded on ${tested.slice(0, 12)} (the newest commit on main that isn't a release commit); nothing is released until it does`)
    }
  }
  tested = git.revParse(tested)
  const reason = supersededReason(git, tested)
  if (reason) {
    annotate('notice', `Nothing to release from ${tested.slice(0, 12)}: ${reason}`)
    return null
  }
  return tested
}

async function plan(args: string[]): Promise<void> {
  const flags = parseFlags(args, ['--tested', '--labels'])
  const git = new Git(ROOT)
  const github = GitHub.fromEnv()

  let tested: string | undefined
  if (flags.values.has('--tested')) {
    const resolved = await resolveTested(git, flags.values.get('--tested')!, github)
    if (!resolved) {
      setOutput('targets', '[]')
      return
    }
    tested = resolved
  }

  const given = flags.values.get('--labels')
  const fixedLabels = given === undefined ? null : given.split(',').map(l => l.trim()).filter(Boolean)
  if (fixedLabels === null && !github) {
    annotate('warning', 'no GITHUB_TOKEN/GITHUB_REPOSITORY: pull request labels are not read, every bump is a patch')
  }
  const labels = async (sha: string) => fixedLabels ?? (github ? github.pullRequestLabels(sha) : [])

  const plans = await planRelease({ targets: TARGETS, git, root: ROOT, tested, labels })
  const apply = flags.switches.has('--apply')
  const summary = planSummary(plans, apply ? 'Release plan' : 'Release preview (what merging this would release)')
  console.log(summary)
  appendSummary(summary)

  const released = plans.filter(p => p.release)
  if (apply && released.length) {
    const date = new Date().toISOString().slice(0, 10)
    const files = applyPlan(ROOT, TARGETS, plans, date)
    console.log(files.length ? `updated ${files.join(', ')}` : 'no files to update')
  }
  setOutput('targets', JSON.stringify(released.map(p => p.id)))
  setOutput('message', releaseCommitMessage(plans))
  for (const p of released) setOutput(`${p.id}_version`, p.next)
}

async function published(args: string[]): Promise<void> {
  const [id] = parseFlags(args, []).positional
  if (!id) throw new Error('usage: published <target>')
  const target = targetById(id)
  const stores = STORES[target.id]
  if (!stores) throw new Error(`${target.id} has no store to check`)
  const version = readTargetVersion(target, file => readFileSync(path.join(ROOT, file), 'utf8'))
  for (const { store, manifest } of stores) {
    const name = storeName(store, JSON.parse(readFileSync(path.join(ROOT, manifest), 'utf8')))
    const found = await isPublished(store, name, version)
    console.log(`${store}: ${name}@${version} ${found ? 'is already published' : 'is not published yet'}`)
    setOutput(store.replace(/-/g, '_'), String(found))
  }
}

async function chromeWebStore(args: string[]): Promise<void> {
  const [zipPath] = parseFlags(args, []).positional
  if (!zipPath) throw new Error('usage: chrome-web-store <zip>')
  const accessToken = process.env.CWS_ACCESS_TOKEN
  const publisherId = process.env.CWS_PUBLISHER_ID
  if (!accessToken || !publisherId) throw new Error('CWS_ACCESS_TOKEN and CWS_PUBLISHER_ID must be set')
  const version = readTargetVersion(targetById('extension'), file => readFileSync(path.join(ROOT, file), 'utf8'))
  const result = await publishToChromeWebStore({
    publisherId, itemId: STORE_EXTENSION_ID, accessToken, version,
    zip: new Uint8Array(readFileSync(path.resolve(zipPath))),
    log: message => console.log(`Chrome Web Store: ${message}`),
  })
  setOutput('result', result)
}

const COMMANDS: Record<string, (args: string[]) => Promise<void>> = {
  plan,
  published,
  'chrome-web-store': chromeWebStore,
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2).filter(a => a !== '--')
  const run = COMMANDS[command ?? '']
  if (!run) {
    console.error(`usage: npm run release -- <${Object.keys(COMMANDS).join('|')}> [options]`)
    process.exit(2)
  }
  await run(args)
}

main().catch(err => {
  annotate('error', err instanceof Error ? err.message : String(err))
  process.exit(1)
})
