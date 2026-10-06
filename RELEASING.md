# Releasing

Nothing is published by hand. Every push to `main` that passes CI runs the
[Release workflow](.github/workflows/release.yml), which releases each target whose shipped
files changed since its last release — and only those.

| Target | Ships to | Version lives in |
| --- | --- | --- |
| `app` | stringutilitybelt.com (Cloudflare Workers) | `package.json`, `package-lock.json`; `CHANGELOG.md` sections |
| `core` | npm `@string-utility-belt/core` | `packages/core/package.json` |
| `cli` | npm `subelt` | `packages/cli/package.json` |
| `mcp` | npm `@string-utility-belt/mcp` + the MCP Registry (+ a `.mcpb` on the GitHub release) | `packages/mcp/package.json`, `packages/mcp/manifest.json`, `server.json` (both versions) |
| `extension` | Chrome Web Store | `packages/extension/manifest.json` |
| `vscode` | VS Code Marketplace (+ Open VSX, opt-in) | `packages/vscode/package.json` |

The CLI's `--version` and the MCP server's reported version are read from their `package.json`
at build time; there is no other copy to keep in step.

## How a release runs

1. **CI passes on `main`** (`ci.yml`). The release only ever ships a commit CI verified: if
   `main` has moved on by the time it starts, it stands down and the newer commit's run releases
   everything instead.
2. **Plan** (`npm run release -- plan`). For each target, the newest `<id>-v<version>` tag
   reachable from `main` is its last release. The target releases when:
   - files it ships changed since that tag (see [What counts as a change](#what-counts-as-a-change)), or
   - its version was raised by hand in a pull request, or
   - it has no tag yet (its first release through this workflow).
3. **Version.** A version the pull request already raised is released as it is. Otherwise it is
   bumped: **patch** by default, **minor** or **major** when a merged pull request that changed the
   target carries the `release:minor` or `release:major` label (the highest wins). All of a target's
   version files are rewritten together, without reformatting; a non-empty `## [Unreleased]` section
   of `CHANGELOG.md` becomes the app's new version section. These edits are pushed to `main` as one
   `chore(release): … [skip ci]` commit.
4. **Deploy**, one job per target, in parallel: build from the release commit, run the package's
   tests against the built output, publish, then tag `<id>-v<version>` and create a GitHub release
   with notes generated from the pull requests since the previous tag. Every job asks its store
   first and skips what is already there, so re-running never publishes twice — and refuses to run
   at all once a newer release of its target exists, so re-running an old job never downgrades.

Pull requests get a **Release preview** check (`release-preview.yml`): the job summary lists what
merging would release and at which versions. It also fails when version files disagree or fall
below a released version, which would stop the release.

### What counts as a change

Each target's path rules live in [`scripts/release/targets.ts`](scripts/release/targets.ts):

- Every package bundles the engine (`src/core/`, `src/types/`, `src/utilities/`), so a utility change
  releases the site and every package. A test in `scripts/release/targets.test.ts` walks each
  package's imports and fails if the rules miss a file it bundles.
- Tests, fixtures, utility guides (for packages), the extension's store listing copy, CI and release
  tooling never trigger a release.
- Root `package.json` / `package-lock.json`: any change except the version counts for the site (its
  build tooling lives there); packages only count production-dependency changes (npm marks the rest
  `dev`), since that's what they bundle. A dev-only Dependabot update redeploys the site only.

### Choosing the version yourself

Label the pull request `release:minor` or `release:major`, or raise the version in the pull request
(every version file of the target, e.g. `npm version 2.0.0 --no-git-tag-version` in the package
directory plus its manifests). The release keeps a raised version as it is. Versions never go down:
the plan fails when version files are below the last release tag. A version is only ever released
with the content it was set for: if the target changes again before that version is released (say,
its deploy failed and another pull request was merged meanwhile), the next release bumps it again.

## Failures, retries and rollbacks

- **A deploy job failed** (store outage, expired credential): fix the cause, then **Re-run failed
  jobs** on that workflow run. The release commit and the other targets are untouched; the job
  publishes what is missing and tags the release.
- **Run the whole release again** — *Actions → Release → Run workflow*. It releases the newest
  commit on `main` that CI passed on, and continues where an earlier run stopped (a version an
  earlier run already bumped is released as it is, not bumped again).
- **Roll back the site:** `npx wrangler rollback` (or *Workers → Deployments* in the Cloudflare
  dashboard), then revert the change on `main`; the revert ships as the next patch release.
- **Packages and extensions:** registries don't take a version back. Revert on `main` and let the
  next patch release supersede it (`npm deprecate <pkg>@<version> "<why>"` for a broken npm version;
  the Chrome Web Store dashboard can also roll back to the previous published version).

## One-time setup

Until a target's store credentials are in place, its deploy job fails with a clear error; the
other targets still release. Store identifiers (not secrets) are **variables**; credentials are
**secrets**. Both can be set per environment (*Settings → Environments*: `production`, `npm`,
`chrome-web-store`, `vscode-marketplace` — created on the first run) or for the repository. Prefer
environments: their secrets are only exposed to that target's job, and you can add protection rules
(e.g. required reviewers on `production`).

| Name | Kind | Environment | For |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | secret | `production` | Workers deploy |
| `CLOUDFLARE_ACCOUNT_ID` | secret | `production` | Workers deploy |
| `NPM_TOKEN` | secret, optional | `npm` | only without npm trusted publishing |
| `MCP_REGISTRY_PRIVATE_KEY` | secret | `npm` | MCP Registry (DNS-verified namespace) |
| `CWS_PUBLISHER_ID` | variable | `chrome-web-store` | Chrome Web Store item path |
| `CWS_SERVICE_ACCOUNT` | variable | `chrome-web-store` | Google service account email |
| `CWS_WORKLOAD_IDENTITY_PROVIDER` | variable | `chrome-web-store` | `projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>` |
| `AZURE_CLIENT_ID` | variable | `vscode-marketplace` | Entra ID identity that publishes |
| `AZURE_TENANT_ID` | variable | `vscode-marketplace` | its tenant |
| `OVSX_PAT` | secret, optional | `vscode-marketplace` | Open VSX (skipped when unset) |
| `RELEASE_APP_ID` | variable, optional | repository | GitHub App that pushes release commits to a protected `main` |
| `RELEASE_APP_PRIVATE_KEY` | secret, optional | repository | its private key |

### 1. Hand the site deploy to the workflow

The site used to deploy through Cloudflare Workers Builds on every push. Turn that off
(*Workers & Pages → string-utility-belt → Settings → Builds*: disconnect, or disable builds for the
production branch — preview builds of other branches can stay), or every push would deploy twice
and bypass CI. Create an API token from the **Edit Cloudflare Workers** template, scoped to the
account and the `stringutilitybelt.com` zone, and set `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID`.

### 2. npm (core, cli, mcp)

For each package on npmjs.com: *Settings → Trusted publishing → GitHub Actions*, repository
`Murraylr/string-utility-belt`, workflow `release.yml`, environment `npm`. No token is stored; npm
issues a short-lived one per publish and attaches provenance. (Fallback: an automation token as
`NPM_TOKEN`.)

### 3. MCP Registry

The `com.stringutilitybelt/*` namespace is verified through DNS. Put the hex Ed25519 private key that
matches the `stringutilitybelt.com` TXT record (`v=MCPv1; k=ed25519; p=…`) in
`MCP_REGISTRY_PRIVATE_KEY` — the same key `mcp-publisher login dns` uses locally.

### 4. VS Code Marketplace (Microsoft Entra ID)

Azure DevOps global personal access tokens retire on 2026-12-01, so the Marketplace is published
with a workload identity instead (`vsce publish --azure-credential`):

1. In Microsoft Entra ID, create an app registration (or a user-assigned managed identity).
2. Add a federated credential: issuer `https://token.actions.githubusercontent.com`, subject
   `repo:Murraylr/string-utility-belt:environment:vscode-marketplace`, audience `api://AzureADTokenExchange`.
3. Add that identity as a member of the `stringutilitybelt` publisher on the
   [Marketplace publisher page](https://marketplace.visualstudio.com/manage) with the *Contributor* role.
4. Set `AZURE_CLIENT_ID` and `AZURE_TENANT_ID`.

Optional: create the `stringutilitybelt` namespace on [open-vsx.org](https://open-vsx.org), sign the
publisher agreement, and set an access token as `OVSX_PAT`.

### 5. Chrome Web Store (service account, keyless)

1. In a Google Cloud project, enable the **Chrome Web Store API** and create a service account
   (no roles needed).
2. In the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole),
   *Account → Service accounts*: add the service account's email. Copy your **publisher ID** from the
   dashboard into `CWS_PUBLISHER_ID`.
3. Create a workload identity pool with a GitHub OIDC provider (issuer
   `https://token.actions.githubusercontent.com`, attribute condition
   `assertion.repository == 'Murraylr/string-utility-belt'`), and grant
   `principalSet://iam.googleapis.com/projects/<number>/locations/global/workloadIdentityPools/<pool>/attribute.repository/Murraylr/string-utility-belt`
   the **Workload Identity User** role on the service account.
4. Set `CWS_SERVICE_ACCOUNT` and `CWS_WORKLOAD_IDENTITY_PROVIDER`.

Each release uploads the package and submits it for review, with automatic publishing once approved.
A submission still in review when a newer version is released is cancelled and replaced by the newer
one (the store reviews one submission at a time).

### 6. Labels

Create the `release:minor` and `release:major` labels (*Issues → Labels*).

### 7. Protect `main` (recommended)

`main` has no branch protection today: anyone with write access can push straight to it, and this
workflow would publish that push to npm and the stores. Add a ruleset that requires pull requests and
the CI checks. The release commit is then pushed by a GitHub App that the ruleset lets bypass it:
create an app with **Contents: read and write** on this repository, install it, add it to the
ruleset's bypass list, and set `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY`.

### First run

No target has a release tag yet, so the first run releases all of them with a patch bump — a store
may already hold the current version with older content, and a version is never reused. The MCP
version files were aligned at 1.3.3 (the newest version the MCP Registry has), so npm and the
registry both get 1.3.4. To keep a target out of the first run, tag the commit whose content its
store already ships, e.g. `git tag vscode-v1.3.0 <sha> && git push origin vscode-v1.3.0`; it then
releases only after its files change.

## Locally

```bash
npm run release -- plan                         # what a release from HEAD would do (read-only)
npm run release -- plan --labels release:minor  # …if the pull request carried that label
npm run release -- preflight mcp                # is the current mcp version on npm / the MCP Registry?
```
