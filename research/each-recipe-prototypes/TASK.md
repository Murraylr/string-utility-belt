# Build the recipe pages that "run on each" unlocked, and refactor three existing recipes

## Context

- Recipes (`src/recipes/<slug>/recipe.ts` + `guide.md`) are pre-rendered pipeline pages at `/recipes/<slug>/`. CLAUDE.md ("Recipes", "Adding a recipe") has the rules; `src/recipes/check.ts` enforces them.
- PR #45 added the `each` step type (split modes `lines` | `delimiter` | `json-array` | `json-values`, top-level only, see `src/core/split.ts`). `define.ts` has `each()`, and `decode-kubernetes-secret` is the first recipe that uses it.
- Before #45, research for the recipe pilot set aside a list of pages that needed a per-item step. That list was prototyped against `main` at 40134fd by six groups (API debugging, DevOps, content/SEO, data/frontend, existing-recipe refactors, open discovery). Each draft was run through the repo's own checker with the build's engine, then reviewed by a second agent told to break it (messy input, demand/competition, "does it really need each?").

**The verified drafts are on a research branch.** Fetch them read-only:

```bash
git fetch origin claude/practical-wright-7rmlbt
git worktree add ../each-research origin/claude/practical-wright-7rmlbt   # or: git show origin/claude/practical-wright-7rmlbt:research/each-recipe-prototypes/<file>
```

- `research/each-recipe-prototypes/README.md` maps every candidate to the file to start from, with its review score.
- `harness.ts` runs `checkRecipe` plus the cross-recipe rules and prints actual sample outputs: `npx vite-node <file>.ts` from the repo root. Imports use absolute `/home/user/string-utility-belt/src/...`, so adjust them if your checkout lives elsewhere.
- Sample generators sit next to the drafts.
- **Do not merge that branch and do not copy the folder into your PR.** Rebuild each recipe properly in `src/recipes/`.

Re-verify everything against current `main` before relying on it: utilities may have changed since 40134fd.

Work in three PRs, in order.

---

## PR 1: prerequisites and refactors (unlabelled: fixes)

### P1. Render nested steps on recipe pages

Today a recipe page hides everything inside an `each` or `branch`:

- `changedParams()` (`src/app/pages/recipes/recipeHelpers.ts:31`) returns `[]` for any non-utility step.
- Only top-level conditions get the "Runs only when… / Skipped (its input passes through) when…" text.
- The step's utility list shows one level only.

Several recipes below rely on settings inside lanes: the tracker drop list, the per-line conditions, the crontab and ssh lanes. A visitor and a crawler of the pre-rendered page would never see them.

Make `RecipeArticle` render nested steps recursively: label, changed params (`ParamList`) and condition with the same wording as top-level steps; the split mode for an `each` ("on each line / value / element"); and lanes plus the merge mode for a `branch`. It must stay `renderToStaticMarkup`-safe, because `scripts/seo/build.ts` renders the same component. Add tests.

### P2. Pluralize the step count

A single-top-level-step recipe currently prints "1 steps, every one editable" (`src/app/pages/recipes/RecipeArticle.tsx:174`) and its OG card says `Recipe · 1 steps` (`scripts/seo/build.ts:581`). Keep the count as top-level (numbered) steps, and pluralize it.

### P3. Helpers for nested containers in `src/recipes/define.ts`

Add `laneEach(id, split, steps, opts)` and `laneBranch(id, lanes, merge, opts)`: no `why`, and regex conditions normalized to `flags: ''` like the top-level helpers. `sanitizeSteps` adds `flags: ''` to nested conditions, and the checker rejects steps that change when sanitized. The drafts currently use raw literals, `delete why` and `as any`. Update CLAUDE.md's recipe section to mention the helpers.

### P4. `gzip_decompress` error message

Short non-gzip input (`{`, `[`, `}`, `H4sIAAAA`) throws "gzip integrity check failed: the CRC-32/size trailer does not match… (corrupt or truncated input)" instead of "not valid gzip data…". Longer text gets the right message. This was reproduced on 40134fd. The reviewer traced it to the trailer check in `gunzipVerified`, plus `apply()` rethrowing integrity errors.

It shows up on the CloudWatch page's "leave a step out" trace and on that page's most common failure (pasted JSON with no payload). Fix it and add tests for those inputs.

### P5. (Recommended) Close two checker loopholes in `check.ts`

- **(a) One utility in a container passes.** A recipe whose only work is one utility wrapped in an `each` counts as having a container, so it passes the "2+ real steps or a container" rule. Example: `each(lines → slug)`; a perLine param on the utility would make that page redundant.
  - Require a lone container step to hold at least 2 real utility steps.
  - `character-count-per-line` (one `each` holding a branch with two utilities and a pass-through lane) must still pass.
- **(b) Queries that contain a utility's head term pass.** `primaryQuery` is rejected only when it is contained in a utility guide title, so "bulk slug generator" passes although it contains the slug page's head term "slug generator".
  - Consider also rejecting queries that contain a title's head term (the part before " — ", without a trailing "Online").
  - Run it against every shipped recipe and utility title. If it is too fuzzy, leave it out and say why in the PR.

### Refactors (reviewed; outputs verified)

Add `updated:` to each refactored recipe and rewrite the guide paragraphs that describe the old steps.

**1. `excel-column-to-sql-in-clause`** (score 8). Draft: `refactors/excel-column-to-sql-in-clause.recipe.ts`.
- New chain: trim_lines → line_dedupe → each(lines: `sql_escape {flavor: ansi, wrap: true}`) → line_affix (join with ", ") → line_affix (`IN (`…`)`).
- Goldens are byte-identical on every sample and on 400 random columns.
- Gain: the flavor setting finally works per value. mysql gives `'O\'Brien'`; mssql adds `N''` only on non-ASCII values. On `main`, mysql merges the column into one literal, which is why the guide documents a workaround.
- Guide:
  - Replace the MySQL workaround with "switch step 3's flavor to mysql", keeping the NO_BACKSLASH_ESCAPES caveat.
  - Mention mssql's `N` prefix.
  - Numeric IDs: "untick wrap in quotes in step 3".
  - Rewrite the stale sentences "Escaping has to happen before quoting…" and "prefix / suffix lines runs twice…".
  - Don't claim Snowflake or BigQuery.

**2. `decode-cloudwatch-logs-data`** (score 7). Use **variant C**: `refactors/verified/decode-cloudwatch-logs-data.variant-c.recipe.ts`. It goes from 6 steps to 4 and keeps the decoded envelope visible as a step:
- regex_extract the `H4sI…` payloads (with condition)
- each(lines: gzip_decompress)
- each(lines: jsonpath `$.logEvents[*].message` → json_to_jsonl)
- each(lines: code_string_unescape json → normalize_line_endings lf, final newline removed)

What changes:
- All four goldens are identical. The `kinesis-event` sample input becomes a 2-record batch made by `refactors/gen-cloudwatch.ts`.
- It removes three documented limits: only the first record of a batch was decoded; Python/Node-printed events failed; messages ending in a literal `\n` failed (the old seam regex).
- New limits for the guide:
  - A bare value wrapped across lines must be joined first.
  - `\/`-escaped payloads fail.
  - A failed record's Base64 stays in the output as a line.
  - CR inside messages becomes LF.
  - Empty output plus "N of N lines failed" means no `H4sI` payload was found.
- Update the jq one-liners for batches (one `base64 -d | gunzip` per record: concatenated Base64 does not decode as one stream).
- Depends on P4.

**3. `bulk-utm-link-builder`** (score 7). Draft: `refactors/bulk-utm-link-builder.recipe.ts`.
- Step 2's lookbehind sed becomes each(lines: unescape_html → `query_params_normalize {drop: 'utm_*', sort: false, dedupe: 'none', dropEmpty: false, decode: false, lowercaseHost: false}`).
  - Keep all six params explicit: the defaults sort, dedupe and lowercase hosts.
  - Use unescape_html, not html_entity_decode, which turns `&region=` into `®ion=`.
- Same step count; all four goldens identical.
- Fixes keys with digits, keys without `=`, and percent-encoded keys. Visitors can extend the drop list with fbclid and gclid.
- **Regression to document:** `utm_` pairs inside a `#fragment` or hash route are no longer removed. The guide currently promises "including inside a hash route", so change that sentence. GA4 reads only the real query.

**Do not refactor the other 10 recipes:**
- spring-boot's dash removal edits keys; json-values only sees values.
- clean-chatgpt and fix-pdf need line deletion, which an `each` cannot do (blanking a line makes unwrap split paragraphs).
- The rest have no per-item work.

---

## PR 2: tier-1 new recipes (`release:minor` + `enhancement`)

**Each page needs:**
- A guide of at least 300 words with honest limits and `/util/<id>/` links; then `npm run check:recipes -- <slug>` and `npm run gen`.
- Synthetic samples only (example.com, RFC 5737 IPs, vendor test vectors), generated by scripts.
- Re-check that every primaryQuery is free, against the others in this PR as well.

**Privacy note for the pages people paste secrets into** (.env, JWT, email lists): the page itself stores nothing. But "Open in the editor" hands the input to the editor, whose input history (IndexedDB `sub` / `inputHistory`, on by default) keeps it, and a share link puts the input in the URL fragment. Say so in those guides and show where to turn history off.

### 1. `env-file-to-kubernetes-secret`

- Query: "env file to kubernetes secret"; DevOps & Config; related to `decode-kubernetes-secret` in both directions.
- Draft: `devops/env-secret.ts` (keep, 7, high demand).
- Chain: `env_to_json {typed: false, expand: false}` (onError stop) → each(json-values: base64_encode) → replace that wraps it as `{"apiVersion":"v1","kind":"Secret","metadata":{"name":"app-env"},"type":"Opaque","data":…}` → json_to_yaml.

Fix and explain:
- The parse step's why overclaims "the way dotenv libraries do". Node's dotenv cuts an unquoted value at any `#`; env_to_json cuts only at ` #`, like python-dotenv and Compose. Reword it, and tell readers to quote values that contain `#`.
- Guide pitfalls of `kubectl create secret generic --from-env-file` (verified on v1.37.1): it keeps quotes, inline comments and trailing whitespace, and rejects `export` and multi-line values.
- Why `data:` and not `stringData:`: kubectl's YAML 1.1 decoder turns `on` into "true".

Limits:
- Env var names y/n/yes/no/on/off (any case) are written unquoted, and kubectl renames them to booleans.
- The name `app-env` is fixed in the template; there is no namespace.
- Keys are not checked against `[-._a-zA-Z0-9]+`.
- Base64 is not encryption: point to SOPS or Sealed Secrets.

### 2. `convert-unix-timestamps-in-json`

- Query: "convert unix timestamps in json to dates"; Web & APIs.
- Draft: `api-debug/ts-recipe.ts` (keep, 7).
- Chain: `json_flatten {arrayNotation: bracket}` → each(json-values: `timestamp_convert {to: iso, timezone: UTC}` with lane condition `^1[2-9]\d{8}(?:\d{3})?(?:\.\d+)?$`) → json_unflatten.
- Handles any depth, top-level arrays and `{data:[…]}`. Phone numbers, small ids, amounts and `expires_in` are left alone.

The guide must name, concretely:
- The value-only heuristic and its false positives: ad-platform `costMicros`, byte counts of 1.2–2 GB, 13-digit ids starting 12–19, 10-digit account ids.
- The 2008-01-10 to 2033-05-18 window; µs and ns are not converted.
- Integers above 2^53 are rounded on re-parse (point to `*_str` fields).
- What fails: JSONL, `curl -i` output, JSONC, Python repr. Link `unescape-stringified-json` for string bodies.
- The 100 000-value limit.

### 3. `decode-jwts-in-log-file`

- Query: "decode multiple jwt tokens"; Web & APIs.
- Use the fixed copy: `api-debug/verified/jwt-recipe.ts` (keep, 7).
- Chain: `extract_preset {type: [jwt], unique: true}` → each(lines, onError empty: `jwt_decode {part: payload}` with onError stop → nested each(json-values: timestamp_convert, condition `^1[4-9]\d{8}(?:\.\d+)?$`)) → `jsonl_to_json {indent: 2}`.
- `part: all` is not allowed: its `isExpired` depends on `Date.now()` and breaks the any-date rule.

Limits:
- URL-encoded tokens (`Bearer%20`, `%3D`) and tokens wrapped across lines are missed.
- 2-part fragments, JWE and Flask cookies are reported and left out.
- Chromium 130+ exports sanitized HARs without Authorization or Cookie headers ("Allow to generate HAR with sensitive data").
- Payload only: link `/util/jwt_verify/`.
- Tokens in logs are live credentials: say that decoding runs locally, and that leaked logs mean rotating the tokens.

### 4. `remove-tracking-parameters-from-urls`

- Query: "remove tracking parameters from urls"; Writing & Marketing; related to `bulk-utm-link-builder`.
- Use the fixed copy: `content-seo/verified/strip-tracking.ts` (7).
- Chain: unescape_html → each(lines: query_params_normalize with the curated drop list and the same six explicit params as the bulk-utm refactor), with the **tightened** `ONE_LINK_WITH_QUERY` lane condition (flags `i`). The first draft's `^\s*\S+\?\S+\s*$` silently deleted CSV columns, closing quotes, `>` and `)`.
- Needs P1, or the tracker list and the condition are invisible on the page.
- Trackers: add `__s` (Drip), `_kx` (Klaviyo), `ck_subscriber_id` (Kit) and `_ga`. Say that `si` and `ref` are kept on purpose.
- Guide: paste URLs only, not HTML source. Not for live ad landing URLs, because removing gclid, gbraid and gad_* breaks attribution. List the limits: params after `#`, `;` queries, double-escaped `&amp;amp;`, trimmed indentation, no dedupe.

### 5. `hash-email-list-for-customer-match`

- Query: "hash emails for customer match".
- Use the fixed copy: `data-frontend/verified/hash-email-list-for-customer-match.ts` (7).
- Chain:
  - replace whitespace, quotes and zero-width characters
  - case lower
  - Gmail-dots replace (Google only)
  - each(lines: `hash {algo: SHA-256}` with condition `^[^@\s<>,;]+@[^@\s<>,;]+$`, so header rows and already-hashed values pass through visibly)

Guide:
- Meta users should leave the Gmail-dots step out; the page's "leave this step out" trace shows exactly that output.
- Google Ads' own UI hashes plaintext uploads, so this recipe is for API, partner or hash-first workflows.
- Plus-addressing is kept.
- Don't cite Google's enhanced-conversions sample as support for the Gmail-only rule: it strips `.` and `+` on every domain.
- `John_Smith@gmail.com` matches Meta's documented example hash; use it as the cross-check.
- Cover MD5 suppression lists as a section here, not as a separate page.

### 6. `extract-domains-from-urls`

- Query: "extract domain from url list"; Data & Spreadsheets.
- Use the fixed copy: `data-frontend/verified/extract-domains-from-urls.ts` (6, high demand).
- Chain: each(lines, onError empty: a clean replace that keeps the first URL and cuts quotes and extra columns → line_affix `https://` only when there is no scheme → url_parse → jsonpath `$.hostname`) → strip a leading `www.`.
- Be honest:
  - It returns the hostname, not the registrable domain (no Public Suffix List utility).
  - Don't claim a regex can't do it. url_parse's edge is the browser's URL rules (ports without a scheme, userinfo, IPv6).
  - IDNs come out as punycode.
  - Mention line_dedupe or line_sort for a unique list.

### 7. User agents → CSV: one page, merging two drafts

- Start from `discovery/verified/ua-def.ts`; the alternative is `data-frontend/parse-user-agent-list-to-csv.ts`.
- Pick one query that does not contain "user agent parser", e.g. "parse user agents from access log" or "user agent list to csv".
- Chain: replace with the verified `UA_FIELD` regex (combined/nginx-main layouts, trailing XFF, syslog and vhost prefixes, escaped quotes; plain UA lines pass through) → each(lines, includeEmpty: user_agent_parse) → jsonl_to_json → json_to_csv with fixed columns.

Issues:
- Goldens depend on ua-parser-js (^2.0.10). Pick long-stable UAs; the recipe will act as a canary on dependency bumps.
- Unknown health checkers give blank rows with `isBot=false`.
- UA reduction: Windows 11 reports as 10, macOS is frozen at 10.15.7, Android Chrome reports "10; K".
- The 100 000-line item budget: beyond it, a later step fails with a misleading error.
- Rows match their input lines by order only. Add a raw-UA column, or tell readers to paste the CSV next to the UA column.
- Competitor: singhajit.com has a free bulk tool.

---

## PR 3: tier-2 recipes (`release:minor`). Ask the user before starting.

These scored 5–6 with lower demand. The pilot's conversion numbers may argue for waiting.

### 8. `character-count-per-line` (6)

- Draft: `content-seo/line-lengths.ts`; needs P2.
- One each(lines) holding a branch: text_stats → jsonpath `$.graphemes`, plus an empty pass-through lane, merged with `' · '`.
- Guide:
  - Google truncates by pixel width, not characters.
  - Google Ads counts CJK characters as 2.
  - Leading and trailing spaces are counted.
  - Offer a tab separator for spreadsheets.
  - filter_lines_by_length counts code points, not graphemes.

### 9. `ssh-key-fingerprints` (6)

- Draft: `devops/ssh-fp.ts`; fingerprints were verified against Go's x/crypto/ssh and Python.
- Limits:
  - A key wrapped across lines gives a wrong fingerprint silently.
  - RFC 4716/PuTTY blocks and certificates are not handled.
  - No MD5 form.
  - Never paste a private key: it passes through unchanged with no warning.
- Optional: an `output: hex|base64` param on `hash` would remove two lane steps.

### 10. `decode-kinesis-records` (6, low demand)

- Draft: `api-debug/verified/kinesis-recipe.ts`. Its regex also accepts single quotes and spaces around the colon, and it has a `python-print` sample.
- Plain-text or CSV payloads make the last step error.
- gzip and KPL-aggregated records are unsupported.
- Link it with the CloudWatch page.

### 11. `explain-crontab-file` (5)

- Draft: `devops/verified/crontab.ts`: the nested describe step uses onError empty, and an unreadable schedule gets a flag comment.
- Do not use onError stop: it inserts a bare, uncommented schedule line into the crontab.
- 5-field syntax only; running it twice duplicates the comments.

### 12. `convert-epoch-timestamps-in-logs` (5)

- Draft: `devops/verified/epoch.ts`, which converts only a timestamp at the start of a line. That removes the byte-count and ID false positives and stays within the 100 000-item budget.
- Mid-line epochs are not converted: say so.

---

## Rejected after review: do not build

- **zip codes with leading zeros:** a perLine sed already does it, and the output gets stripped again in Excel.
- **IDN → punycode list:** better as a `punycode_encode` perLine option plus UTS #46 mapping; Punycoder already does lists.
- **CIDR list → ranges:** silently drops lines; competitors convert both directions.
- **JSONL invalid lines:** dedicated validators do more.
- **list → JSON array:** exact-match tools rank and do more.
- **MD5 suppression list:** fold into page 5's guide.
- **Base64 per line:** a single wrapped utility; base64decode.org has this option.
- **CamelCase hashtags:** a single sed does it better, and format_case lowercases acronyms.
- **bulk slug generator:** a single wrapped utility that competes with `/util/slug/`; add a perLine param to `slug` instead.
- **title tag length checker:** filter_lines_by_length covers it, and characters are the wrong metric.
- **palette contrast:** strong visual competitors; low value.
- **Tailwind → oklch:** breaks on numeric keys; the official upgrade tool exists.
- **JSON log timestamps:** cannibalizes page 2, and silently skips kubectl/docker-prefixed lines.
- **UA breakdown by count:** sed plus uniq_count already does it.
- **Docker config.json auth:** thin, and competes with `decode-kubernetes-secret`.

## Follow-ups to list in a PR description, not to do here

- `slug` perLine param and apostrophe folding
- `punycode_encode` perLine and UTS #46 mapping
- `hash` output-format param
- a YAML 1.1 compatibility option on `json_to_yaml`
- a key-aware condition for json-values items (would fix page 2's false positives)
- numeric keys in `json5_parse`

## Done means

- Each PR passes:
  - `npm test`
  - `npm run typecheck`, plus `tsconfig.worker.json` and every `packages/*/tsconfig.json`
  - `npm run lint`
  - `npm run build`, `npm run check:bundle` and `npm run build:seo`
  - `npm run check:recipes`
- `CHANGELOG.md` `[Unreleased]` is updated.
- Pre-rendered pages show nested steps (check the `/recipes/<slug>/` HTML).
- Labels:
  - PR 1: none (fixes).
  - PR 2 and PR 3: `release:minor` + `enhancement`.
- Delete `research/each-recipe-prototypes/` from the research branch only if the user asks; never add it to `main`.
