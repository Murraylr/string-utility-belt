// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Fetch } from './http'
import {
  NPM_AUDIENCE, githubPublisherIdentity, jwtClaims, npmAuthReport, npmOidcLog, oidcDiagnosis, publisherIdentity,
  type IdentityResult, type PublisherIdentity,
} from './npm-auth'

const CLAIMS = {
  sub: 'repo:String-Utility-Belt/string-utility-belt:environment:npm',
  aud: NPM_AUDIENCE,
  repository: 'String-Utility-Belt/string-utility-belt',
  repository_owner: 'String-Utility-Belt',
  workflow_ref: 'String-Utility-Belt/string-utility-belt/.github/workflows/release.yml@refs/heads/main',
  environment: 'npm',
  runner_environment: 'github-hosted',
}

const segment = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
const jwt = (claims: unknown) => `${segment({ alg: 'RS256', typ: 'JWT' })}.${segment(claims)}.signature`

const PUBLISHER: PublisherIdentity = {
  owner: 'String-Utility-Belt', repository: 'string-utility-belt', workflow: 'release.yml', environment: 'npm', selfHosted: false,
}
const IDENTITY: IdentityResult = { identity: PUBLISHER }

describe('jwtClaims', () => {
  it('reads the claims of a token without verifying it', () => {
    expect(jwtClaims(jwt(CLAIMS))).toEqual(CLAIMS)
  })

  it('refuses what is not a token with an object of claims', () => {
    expect(() => jwtClaims('abc')).toThrow(/not a JSON Web Token/)
    expect(() => jwtClaims(`a.${segment([1])}.c`)).toThrow(/not an object/)
  })
})

describe('publisherIdentity', () => {
  it('reads the fields npm matches a trusted publisher against', () => {
    expect(publisherIdentity(CLAIMS)).toEqual(PUBLISHER)
  })

  it('takes the bare workflow file name, whatever the ref, and has no environment outside one', () => {
    expect(publisherIdentity({
      ...CLAIMS,
      environment: undefined,
      workflow_ref: 'Org/repo/.github/workflows/publish.yaml@refs/heads/release/v1',
      runner_environment: 'self-hosted',
    })).toMatchObject({ workflow: 'publish.yaml', environment: null, selfHosted: true })
  })

  it('names a missing claim', () => {
    expect(() => publisherIdentity({ ...CLAIMS, workflow_ref: undefined })).toThrow(/no "workflow_ref" claim/)
  })
})

describe('githubPublisherIdentity', () => {
  const env = { ACTIONS_ID_TOKEN_REQUEST_URL: 'https://token.actions.example/x?api-version=2.0', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'request-token' }

  it('asks GitHub for a token with npm\'s audience and reads its identity', async () => {
    const fetch = vi.fn<Fetch>(async () => Response.json({ value: jwt(CLAIMS) }))
    expect(await githubPublisherIdentity(env, { fetch })).toEqual(IDENTITY)
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://token.actions.example/x?api-version=2.0&audience=npm%3Aregistry.npmjs.org')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer request-token')
  })

  it('reports a job without id-token: write, a refusal and a malformed answer instead of throwing', async () => {
    expect(await githubPublisherIdentity({})).toEqual({ problem: expect.stringContaining('id-token: write') })
    const refused = vi.fn<Fetch>(async () => new Response(null, { status: 403 }))
    expect(await githubPublisherIdentity(env, { fetch: refused })).toEqual({ problem: expect.stringContaining('HTTP 403') })
    const empty = vi.fn<Fetch>(async () => Response.json({}))
    expect(await githubPublisherIdentity(env, { fetch: empty })).toEqual({ problem: expect.stringContaining('without an OIDC token') })
    const garbled = vi.fn<Fetch>(async () => Response.json({ value: 'not-a-jwt' }))
    expect(await githubPublisherIdentity(env, { fetch: garbled })).toEqual({ problem: expect.stringContaining('not a JSON Web Token') })
  })
})

describe('npmOidcLog', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true })
    dir = undefined
  })

  it('collects the oidc entries of every level from npm\'s debug logs, oldest log first', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'npm-logs-'))
    writeFileSync(path.join(dir, '2026-10-07T20_37_14_799Z-debug-0.log'), [
      '0 verbose cli /usr/bin/node /usr/bin/npm',
      '28 silly oidc Skipped because no id_token available',
      '30 verbose oidc Failed token exchange request with body message: OIDC token exchange error - package not found\r',
      '41 error code ENEEDAUTH',
    ].join('\n'))
    writeFileSync(path.join(dir, '2026-10-07T20_37_20_000Z-debug-0.log'), '12 verbose oidc Cleared previous exchange token\n')
    writeFileSync(path.join(dir, 'notes.txt'), '1 verbose oidc not a log\n')
    expect(npmOidcLog(dir)).toEqual([
      'Skipped because no id_token available',
      'Failed token exchange request with body message: OIDC token exchange error - package not found',
      'Cleared previous exchange token',
    ])
  })

  it('reads a missing directory as no entries', () => {
    expect(npmOidcLog(path.join(tmpdir(), 'no-such-npm-logs-dir'))).toEqual([])
  })
})

describe('oidcDiagnosis', () => {
  it('tells a refused exchange from a refused publish, a missing token and no attempt at all', () => {
    expect(oidcDiagnosis(['Failed token exchange request with body message: nope'])).toMatch(/no trusted publisher .* matches this job/)
    expect(oidcDiagnosis(['Successfully retrieved and set token'])).toMatch(/allows `npm publish`/)
    expect(oidcDiagnosis(['Failed to fetch id_token from GitHub: received an invalid response'])).toMatch(/id-token: write/)
    expect(oidcDiagnosis(['Skipped because incorrect permissions for id-token within GitHub workflow'])).toMatch(/id-token: write/)
    expect(oidcDiagnosis(['Failure with message: boom'])).toMatch(/its log below says how/)
    expect(oidcDiagnosis([])).toMatch(/did not attempt trusted publishing/)
  })
})

describe('npmAuthReport', () => {
  it('shows npm\'s log and exactly what the trusted publisher must read', () => {
    const report = npmAuthReport('subelt', ['Failed token exchange request with body message: nope'], IDENTITY)
    expect(report).toContain('### Why npm refused to publish subelt')
    expect(report).toContain('- Failed token exchange request with body message: nope')
    expect(report).toContain('| Organization or user | `String-Utility-Belt` |')
    expect(report).toContain('| Repository | `string-utility-belt` |')
    expect(report).toContain('| Workflow filename | `release.yml` |')
    expect(report).toContain('| Environment name | `npm` (or empty) |')
    expect(report).toContain('| Allowed actions | `npm publish` ticked |')
  })

  it('says when there is no environment, the runner is self-hosted, or the identity is unknown', () => {
    const report = npmAuthReport('x', [], { identity: { ...PUBLISHER, environment: null, selfHosted: true } })
    expect(report).toContain('| Environment name | empty |')
    expect(report).toContain('self-hosted runner')
    expect(report).toContain('- (no entries)')
    expect(npmAuthReport('x', [], { problem: 'no token' })).toContain('This job\'s identity is unknown: no token.')
  })
})
