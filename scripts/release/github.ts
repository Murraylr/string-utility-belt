import { appendFileSync } from 'node:fs'
import { ensureOk, request, type Fetch } from './http'

/** The GitHub REST calls the release planner makes, with the job's `GITHUB_TOKEN`. */
export class GitHub {
  constructor(
    private readonly token: string,
    private readonly repository: string,
    private readonly apiUrl = 'https://api.github.com',
    private readonly fetchImpl?: Fetch,
  ) {}

  /** Labels of the pull request(s) a commit on main came from (none for a direct push). */
  async pullRequestLabels(sha: string): Promise<string[]> {
    const pulls = await this.get(`/repos/${this.repository}/commits/${sha}/pulls`) as { merged_at?: string | null; labels?: { name?: string }[] }[]
    return pulls
      .filter(p => p.merged_at)
      .flatMap(p => (p.labels ?? []).map(l => l.name).filter((n): n is string => typeof n === 'string'))
  }

  /** Whether the CI workflow (`ci.yml`) succeeded for a push of `sha`. */
  async ciSucceeded(sha: string): Promise<boolean> {
    const runs = await this.get(
      `/repos/${this.repository}/actions/workflows/ci.yml/runs?head_sha=${sha}&event=push&status=success&per_page=1`,
    ) as { total_count?: number }
    return (runs.total_count ?? 0) > 0
  }

  private async get(route: string): Promise<unknown> {
    const res = await request(`${this.apiUrl}${route}`, {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${this.token}`,
        'x-github-api-version': '2022-11-28',
      },
    }, { fetch: this.fetchImpl })
    return (await ensureOk(res, `GitHub API ${route}`)).json()
  }

  /** A client from the Actions environment, or `null` outside Actions / without a token. */
  static fromEnv(env: NodeJS.ProcessEnv = process.env): GitHub | null {
    const token = env.GITHUB_TOKEN
    const repository = env.GITHUB_REPOSITORY
    return token && repository ? new GitHub(token, repository, env.GITHUB_API_URL || undefined) : null
  }
}

/** Sets a step output (`steps.<id>.outputs.<name>`); a no-op outside Actions. */
export function setOutput(name: string, value: string, env: NodeJS.ProcessEnv = process.env): void {
  if (/[\r\n]/.test(value)) throw new Error(`step output ${name} must be a single line`)
  if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, `${name}=${value}\n`)
}

/** Appends markdown to the job summary; a no-op outside Actions. */
export function appendSummary(markdown: string, env: NodeJS.ProcessEnv = process.env): void {
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${markdown}\n`)
}

/** A workflow command annotation (`::notice::` / `::error::`) that also reads well in a terminal. */
export function annotate(level: 'notice' | 'warning' | 'error', message: string): void {
  console.log(`::${level}::${message.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`)
}
