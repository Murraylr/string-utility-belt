import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { request, type Fetch } from './http'

/**
 * Why npm refused a publish from GitHub Actions. With trusted publishing, npm swaps the job's
 * OIDC token for a publish token, but it logs the outcome of that exchange only at verbose
 * level and then fails with a bare ENEEDAUTH. This puts npm's own account of the exchange next
 * to the identity the job presented, which is exactly what the package's trusted publisher on
 * npmjs.com has to match.
 */

/** The audience npm requests for registry.npmjs.org (`npm:<registry host>`). */
export const NPM_AUDIENCE = 'npm:registry.npmjs.org'

/** The parts of a GitHub Actions OIDC token that npm matches a trusted publisher against. */
export interface PublisherIdentity {
  owner: string
  repository: string
  workflow: string
  environment: string | null
  selfHosted: boolean
}

export type IdentityResult = { identity: PublisherIdentity } | { problem: string }

/** The claims of a JWT, unverified: for reporting what a token says, never for trusting it. */
export function jwtClaims(jwt: string): Record<string, unknown> {
  const parts = jwt.split('.')
  if (parts.length !== 3 || !parts[1]) throw new Error('not a JSON Web Token')
  const claims: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  if (!claims || typeof claims !== 'object' || Array.isArray(claims)) throw new Error('JSON Web Token claims are not an object')
  return claims as Record<string, unknown>
}

function claim(claims: Record<string, unknown>, name: string): string {
  const value = claims[name]
  if (typeof value !== 'string' || !value) throw new Error(`the OIDC token has no "${name}" claim`)
  return value
}

/** The trusted-publisher fields a GitHub Actions OIDC token carries. */
export function publisherIdentity(claims: Record<string, unknown>): PublisherIdentity {
  const repository = claim(claims, 'repository')
  // `<owner>/<repo>/.github/workflows/<file>@<ref>`: npm wants the bare file name
  const workflowPath = claim(claims, 'workflow_ref').split('@', 1)[0]
  const environment = claims.environment
  return {
    owner: claim(claims, 'repository_owner'),
    repository: repository.slice(repository.indexOf('/') + 1),
    workflow: workflowPath.slice(workflowPath.lastIndexOf('/') + 1),
    environment: typeof environment === 'string' && environment ? environment : null,
    selfHosted: claims.runner_environment === 'self-hosted',
  }
}

/** Asks GitHub for this job's OIDC token, as npm does, and reads the identity it carries. */
export async function githubPublisherIdentity(
  env: NodeJS.ProcessEnv = process.env,
  opts: { fetch?: Fetch } = {},
): Promise<IdentityResult> {
  const url = env.ACTIONS_ID_TOKEN_REQUEST_URL
  const token = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN
  if (!url || !token) {
    return { problem: 'this job cannot request an OIDC token from GitHub: it needs `permissions: id-token: write`' }
  }
  const tokenUrl = new URL(url)
  tokenUrl.searchParams.append('audience', NPM_AUDIENCE)
  try {
    const res = await request(tokenUrl.href, {
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    }, { fetch: opts.fetch, retries: 2 })
    if (!res.ok) return { problem: `GitHub refused this job an OIDC token (HTTP ${res.status})` }
    const { value } = await res.json() as { value?: unknown }
    if (typeof value !== 'string') return { problem: 'GitHub answered without an OIDC token' }
    return { identity: publisherIdentity(jwtClaims(value)) }
  } catch (err) {
    return { problem: `could not read this job's OIDC token: ${err instanceof Error ? err.message : String(err)}` }
  }
}

/**
 * npm's `oidc` log entries (every level, oldest first) from the debug logs in `logsDir`, the
 * directory a publish ran with `--logs-dir`. A missing directory reads as no entries.
 */
export function npmOidcLog(logsDir: string): string[] {
  let files: string[]
  try {
    files = readdirSync(logsDir).filter(f => f.endsWith('.log')).sort()
  } catch {
    return []
  }
  return files.flatMap(file => readFileSync(path.join(logsDir, file), 'utf8')
    .split('\n')
    // `<n> <level> oidc <message>`
    .map(line => /^\d+ \w+ oidc (.+)$/.exec(line.trimEnd())?.[1])
    .filter((message): message is string => !!message))
}

/** What npm's log says went wrong, in one sentence. */
export function oidcDiagnosis(log: readonly string[]): string {
  if (log.some(l => l.startsWith('Successfully retrieved'))) {
    return 'The token exchange succeeded, so npm accepted this job as a trusted publisher of the package; '
      + 'the registry refused the publish itself (see npm\'s error above). On a 403, make sure the trusted publisher '
      + 'allows `npm publish`: publishers created since 2026-09-03 allow only `npm stage publish` until you tick it. '
      + 'On a 422, `repository.url` in package.json does not name this repository.'
  }
  if (log.some(l => l.startsWith('Failed token exchange'))) {
    return 'npm has no trusted publisher for this package that matches this job. Compare its settings with the table '
      + 'below, field by field: every field is case-sensitive.'
  }
  if (log.some(l => l.includes('id_token') || l.includes('id-token'))) {
    return 'npm could not get an OIDC token from GitHub for this job (`permissions: id-token: write`).'
  }
  if (log.length) return 'npm\'s trusted-publishing attempt failed; its log below says how.'
  return 'npm did not attempt trusted publishing: it needs npm 11.5.1 or later, on a GitHub-hosted runner.'
}

/** A markdown report on a refused publish of `name`, for the job log and summary. */
export function npmAuthReport(name: string, log: readonly string[], identity: IdentityResult): string {
  const lines = [
    `### Why npm refused to publish ${name}`,
    '',
    oidcDiagnosis(log),
    '',
    'npm\'s trusted-publishing log:',
    '',
    ...(log.length ? log.map(l => `- ${l}`) : ['- (no entries)']),
    '',
  ]
  if ('problem' in identity) {
    lines.push(`This job's identity is unknown: ${identity.problem}.`)
    return lines.join('\n')
  }
  const { owner, repository, workflow, environment, selfHosted } = identity.identity
  if (selfHosted) lines.push('This job ran on a self-hosted runner, which npm trusted publishing does not support.', '')
  lines.push(
    `The package's trusted publisher on npmjs.com (package Settings → Trusted publishing → GitHub Actions) must read:`,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Organization or user | \`${owner}\` |`,
    `| Repository | \`${repository}\` |`,
    `| Workflow filename | \`${workflow}\` |`,
    `| Environment name | ${environment ? `\`${environment}\` (or empty)` : 'empty'} |`,
    '| Allowed actions | `npm publish` ticked |',
  )
  return lines.join('\n')
}
