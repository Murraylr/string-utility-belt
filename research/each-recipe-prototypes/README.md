# "Run on each" recipe prototypes — research, not for merge

Draft recipes that use the `each` step (PR #45), prototyped and adversarially reviewed against
`main` at 40134fd. **This folder is reference material for building the real recipes in
`src/recipes/`. Do not merge it, and do not copy it into `src/` as is.**

## Running a prototype

From the repo root (the files import `/home/user/string-utility-belt/src/...` by absolute path;
adjust that prefix if your checkout lives elsewhere):

```bash
npx vite-node research/each-recipe-prototypes/<path>.ts
```

`harness.ts` runs the repo's own checker (`checkRecipe` + the cross-recipe rules against every
recipe and utility guide) with the build's engine, drops guide-prose problems (drafts have no
`guide.md`) and prints each sample's actual output. `smoke.ts` shows its use.

## The file to start from, per candidate

The reviewed copy (under a `verified/` folder) wins wherever one exists.

| Candidate (slug) | Start from | Run with | Review |
| --- | --- | --- | --- |
| env-file-to-kubernetes-secret | `devops/env-secret.ts` | itself | keep · 7 |
| convert-unix-timestamps-in-json | `api-debug/ts-recipe.ts` | `api-debug/ts-run.ts` | keep · 7 |
| decode-jwts-in-log-file | `api-debug/verified/jwt-recipe.ts` | `api-debug/verified/jwt-run.ts` | keep (fixed) · 7 |
| remove-tracking-parameters-from-urls | `content-seo/verified/strip-tracking.ts` | itself | fixed · 7 |
| hash-email-list-for-customer-match | `data-frontend/verified/hash-email-list-for-customer-match.ts` | `data-frontend/run-all.ts <file>` | fixed · 7 |
| extract-domains-from-urls | `data-frontend/verified/extract-domains-from-urls.ts` | `data-frontend/run-all.ts <file>` | fixed · 6 |
| parse-user-agents-from-access-log | `discovery/verified/ua-def.ts` (alt: `data-frontend/parse-user-agent-list-to-csv.ts`) | `discovery/verified/ua.ts` | fixed · 6 |
| character-count-per-line | `content-seo/line-lengths.ts` | itself | keep · 6 |
| ssh-key-fingerprints | `devops/ssh-fp.ts` | itself | keep · 6 |
| decode-kinesis-records | `api-debug/verified/kinesis-recipe.ts` | `api-debug/verified/kinesis-run.ts` | fixed · 6 |
| explain-crontab-file | `devops/verified/crontab.ts` (wraps `devops/crontab.ts`) | itself | fixed · 5 |
| convert-epoch-timestamps-in-logs | `devops/verified/epoch.ts` (wraps `devops/epoch.ts`) | itself | fixed · 5 |
| refactor: excel-column-to-sql-in-clause | `refactors/excel-column-to-sql-in-clause.recipe.ts` | `refactors/excel.ts` | keep · 8 |
| refactor: decode-cloudwatch-logs-data | `refactors/verified/decode-cloudwatch-logs-data.variant-c.recipe.ts` | `refactors/verified/cw-variant-c.ts` | fixed · 7 |
| refactor: bulk-utm-link-builder | `refactors/bulk-utm-link-builder.recipe.ts` | `refactors/utm.ts` | keep · 7 |

Sample generators kept next to the drafts: `refactors/gen-cloudwatch.ts`, `api-debug/gen-*.mjs`,
`api-debug/verified/gen-py-kinesis.py`, `devops/review/genkeys.py` (public keys only, in
`devops/review/keys.json`).

Rejected after review (do not build): add-leading-zeros-to-zip-codes, convert-idn-domains-to-punycode,
cidr-list-to-ip-ranges, find-invalid-lines-in-jsonl, list-to-json-array, md5-email-suppression-list,
decode-base64-each-line, camel-case-hashtags, bulk-slug-generator, check-title-tag-lengths,
check-palette-contrast-on-white-and-black, tailwind-colors-to-oklch-theme, json-log-timestamps-to-dates,
user-agent-breakdown-from-access-log, decode-docker-config-auth; and no refactor for the other 10
shipped recipes. The reasons, and the full build brief, are in `TASK.md`.

Delete this folder once the recipes it describes have shipped.
