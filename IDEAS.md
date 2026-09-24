# String Utility Belt — Exhaustive Expansion Roadmap

Everything that could be added to make this the most useful and powerful string-pipeline tool possible.
Organized by area; within each section, items marked **(quick)** need no new dependencies, **(dep)** need a
library, **(wasm)** need a WASM build, **(arch)** need an architecture change first.

> **Status:** everything below is implemented except the **Raycast and Alfred extensions** (§12),
> which were skipped: both are macOS-only and could not be built or verified here. Sections 1–7 added
> 210 utilities (registry: 246). Sections 8–13 — engine, params/types, I/O, app UX, platform
> (PWA, core package, CLI, HTTP API, MCP server, browser + VS Code extensions, embed mode, schema
> versioning) and infra (property/golden/E2E tests, bundle budget, benchmarks, SEO build) — are in.
> The "core package" is a build artifact (`packages/core`) over `src/core` + the utilities rather
> than a physical move of the source tree. The inventory line below is the pre-roadmap snapshot.

Current inventory (36 utilities): base64_encode/decode, case, count, diacritics, escape_html/unescape_html,
format_case, get_bytes, hash (SHA-256/384), hex_encode/decode, json_escape/unescape/minify/pretty, length,
line_dedupe, line_sort, md5, normalize, number_lines, pad, regex_extract, remove_blank_lines, repeat,
replace, reverse, rot13, slice, slug, split_join, trim, truncate, url_encode/decode.

---

## 1. New utilities — Encoding & Decoding

- **base32 encode/decode** (quick) — RFC 4648, with hex-alphabet variant
- **base58 encode/decode** (quick) — Bitcoin/IPFS alphabet
- **base62 / base85 (Ascii85) / base91 encode/decode** (quick)
- **URL-safe base64** (quick) — or a `variant` param on the existing base64 utilities
- **binary (0s/1s) encode/decode** (quick) — with grouping/separator options
- **octal encode/decode** (quick)
- **quoted-printable encode/decode** (quick) — email debugging
- **punycode / IDN encode-decode** (quick-ish) — `xn--` domains
- **Unicode escape encode/decode** (quick) — `\uXXXX`, `\u{XXXXX}`, `U+` notation, HTML `&#x` numeric refs
- **code points ↔ text** (quick) — space-separated hex/dec code points
- **HTML entity encode** (quick) — named vs numeric, "minimal" vs "everything non-ASCII" modes (escape_html covers only the minimal case)
- **XML escape/unescape** (quick)
- **morse code encode/decode** (quick)
- **gzip / deflate compress & decompress** (quick) — native `CompressionStream`/`DecompressionStream`; pairs with base64 for "decode that compressed blob"
- **brotli decompress** (wasm)
- **charset decode** (quick) — Latin-1, Windows-1252, Shift-JIS etc. via `TextDecoder(label)`; fixes mojibake
- **BOM add/remove/detect** (quick)
- **data URI build/parse** (quick) — text or bytes ↔ `data:mime;base64,...`
- **shell quote/escape** (quick) — POSIX single-quote, PowerShell, CMD
- **SQL string escape** (quick)
- **C/Java/Python string literal escape/unescape** (quick)

## 2. New utilities — Ciphers & Crypto

- **caesar / ROT-N** (quick) — generalize rot13 with a shift param; include ROT47
- **atbash** (quick)
- **vigenère encode/decode** (quick)
- **XOR with key** (quick) — text or hex key, works on bytes
- **rail fence / columnar transposition** (quick) — puzzle/CTF staples
- **HMAC** (quick) — SHA-1/256/384/512 via SubtleCrypto, key param, hex/base64 output
- **AES encrypt/decrypt** (quick) — AES-GCM via SubtleCrypto with PBKDF2 password derivation
- **SHA-1 and SHA-512** (quick) — SubtleCrypto already supports both; extend the existing hash utility
- **SHA-3 / Keccak / BLAKE2/3** (dep or wasm)
- **CRC-32 / Adler-32 / FNV-1a / xxHash / MurmurHash3** (quick) — pure-JS implementations are tiny
- **bcrypt / argon2 hash & verify** (wasm)
- **JWT decode** (quick) — split, base64url-decode header+payload, pretty-print, show expiry as human date
- **JWT verify** (quick) — HS256/384/512 via SubtleCrypto with a secret param
- **checksum verify** (quick) — compare input's hash against an expected value param, report match/mismatch

## 3. New utilities — JSON, Data & Config Formats

- **json validate** (quick) — report error with line/column position instead of just failing
- **json sort keys** (quick) — recursive, with depth option
- **json flatten / unflatten** (quick) — nested ↔ dot-path keys
- **json diff** (quick-ish) — needs a second-input param (see §8)
- **jsonpath / jq-lite query** (dep) — extract via `$.store.book[*].title`; JMESPath is a small dep
- **json ↔ yaml** (dep) — `yaml` package
- **json ↔ toml** (dep)
- **json ↔ csv** (quick) — array-of-objects ↔ rows, delimiter + header options
- **json ↔ xml** (dep)
- **json ↔ query string** (quick) — `URLSearchParams`, nested-bracket convention option
- **json ↔ .env** (quick) — KEY=value lines
- **json5 / jsonc parse** (dep) — strip comments and trailing commas → strict JSON
- **jsonl split/join** (quick) — JSON Lines ↔ JSON array
- **json to typescript interface** (quick-ish) — infer types from a sample; huge dev appeal
- **json to json-schema / validate against schema** (dep)
- **csv tools** (quick): change delimiter, extract/reorder/drop columns, transpose, header case-normalize
- **csv ↔ markdown table** (quick)
- **csv ↔ html table** (quick)
- **csv → sql insert statements** (quick)
- **markdown table prettify** (quick) — align pipes
- **xml pretty / minify** (quick via DOMParser)
- **html to markdown** (dep — turndown) and **markdown to html** (dep — marked/micromark)
- **strip markdown** (quick)
- **sql format / minify** (dep — sql-formatter)
- **ini parse → json** (quick)
- **cron expression → human description** (dep or hand-rolled)
- **msgpack / protobuf-wire decode** (dep) — niche but unique

## 4. New utilities — Text & Line Operations

- **grep lines** (quick) — keep/remove lines matching substring or regex; the single most-used missing tool
- **head / tail** (quick) — first/last N lines or chars
- **line reverse / shuffle** (quick) — add as modes on line_sort or standalone
- **sort modes** (quick) — extend line_sort: numeric, natural (v2 < v10), by length, by Nth column, random
- **uniq -c** (quick) — count duplicate lines, output `count<TAB>line`, sort by frequency
- **filter lines by length** (quick)
- **trim each line** (quick)
- **prefix/suffix each line** (quick) — also "wrap each line in quotes + join with commas" = instant SQL IN-list builder
- **indent / dedent** (quick) — add/strip N spaces or tabs
- **tabs ↔ spaces** (quick) — with tab-width param
- **word wrap** (quick) — hard wrap at N columns, preserve-words option
- **unwrap / reflow** (quick) — join soft-wrapped lines into paragraphs
- **align columns** (quick) — like `column -t`, pad fields so columns line up
- **normalize line endings** (quick) — CRLF ↔ LF, and detect mode
- **collapse whitespace** (quick) — runs of spaces/newlines → single
- **strip HTML tags** (quick)
- **strip ANSI escape codes** (quick) — pasted terminal output
- **strip punctuation / digits / non-alphanumeric / non-ASCII** (quick) — one utility with a mode select
- **remove invisible characters** (quick) — zero-width spaces, soft hyphens, control chars, BiDi marks; also a "reveal them" mode
- **smart quotes ↔ straight quotes** (quick) — also em/en-dash and ellipsis normalization; "sanitize Word paste"
- **swap case** (quick)
- **alternating / mocking case** (quick)
- **random case** (quick)
- **reverse words** (quick) — reverse word order, not characters
- **shuffle characters/words** (quick)
- **sort words within line** (quick)
- **initials / acronym extract** (quick)
- **substring before/after delimiter** (quick)
- **insert at position** (quick)
- **chunk** (quick) — split into pieces of N chars/lines with separator
- **translate characters (tr)** (quick) — map `abc` → `xyz`
- **multi-rule replace** (quick-ish) — a list of find→replace pairs applied in order (needs key-value list param, §9)
- **sed script** (quick) — apply `s/foo/bar/g` style lines
- **extract presets** (quick) — one utility with a select: URLs, email addresses, IPv4/IPv6, numbers, hashtags, @mentions, hex colors, UUIDs, quoted strings
- **pluralize / singularize** (dep)
- **number to words / words to number** (quick-ish)
- **roman numerals ↔ arabic** (quick)
- **ordinalize** (quick) — 1 → 1st
- **leet speak** (quick — fun)
- **unicode text styles** (quick — fun/viral): fullwidth vaporwave, small caps, bubble, upside-down, bold/italic/monospace math alphabets, zalgo
- **figlet / ASCII banner** (dep — fun)
- **box drawing** (quick) — surround text with a Unicode box

## 5. New utilities — Analysis & Inspection

- **text statistics** (quick) — upgrade count: sentences, paragraphs, unique words, avg word/sentence length, byte size in UTF-8/16
- **word frequency table** (quick) — with top-N, stop-word filter
- **character frequency** (quick)
- **readability scores** (quick) — Flesch-Kincaid, SMOG, Coleman-Liau
- **reading time estimate** (quick)
- **entropy** (quick) — Shannon bits/char; password-strength hint
- **n-gram frequency** (quick)
- **unicode inspector** (quick) — per character: code point, name (dep for names DB), category, UTF-8 bytes; the "why does this string break my app" tool
- **detect format** (quick) — guess what the input is: base64? hex? JWT? URL-encoded? JSON? gzip? and report confidence; foundation for the "magic" feature in §8
- **diff two texts** (dep — diff lib) — line/word/char granularity; needs second input (§8)
- **string distance** (quick) — Levenshtein/Jaro-Winkler between input and a param
- **language detect** (dep)
- **validate** (quick) — one utility, mode select: email, URL, UUID, IPv4/6, semver, credit-card Luhn, ISBN; outputs valid/invalid + reason

## 6. New utilities — Generators (source steps that ignore/replace input)

- **uuid** (quick) — v4 and v7, count param, upper/lower
- **ulid / nanoid** (quick/dep)
- **random string** (quick) — length, charset (alpha/num/symbols/custom), crypto-secure
- **password generator** (quick) — with pronounceable and passphrase (diceware) modes
- **random bytes** (quick) — as hex/base64
- **lorem ipsum** (quick) — words/sentences/paragraphs
- **number sequence** (quick) — start/end/step, padding, one per line
- **repeat/template expand** (quick) — template with `{i}`, `{random}`, `{uuid}` placeholders × N rows: instant test-data builder
- **fake data** (dep) — names, emails, addresses
- **current timestamp** (quick) — now in ISO/unix/RFC formats
- **qr code** (dep) — SVG output of the input text

## 7. New utilities — Web, Dev & Numbers

- **url parse** (quick) — URL → JSON breakdown (protocol/host/path/params); inverse: build URL from JSON
- **query params sort/dedupe** (quick) — normalize URLs for comparison
- **timestamp convert** (quick) — unix s/ms ↔ ISO 8601 ↔ RFC 2822 ↔ local, auto-detect input
- **date format** (dep — date-fns) — arbitrary format strings, timezone convert
- **duration humanize** (quick) — 86400 → "1 day"
- **number base convert** (quick) — bin/oct/dec/hex/arbitrary base N
- **number format** (quick) — thousands separators, fixed decimals, engineering/scientific, locale
- **bytes humanize** (quick) — 1536 → "1.5 KiB", both directions
- **color convert** (quick) — hex ↔ rgb ↔ hsl ↔ oklch; batch (one per line); contrast-ratio pair check
- **ip tools** (quick) — int ↔ dotted-quad, IPv6 compress/expand, CIDR expand/contains
- **mac address format** (quick) — colons/dashes/dots/bare
- **http headers ↔ json** (quick) — parse raw header blocks
- **curl parse/build** (quick-ish) — curl command ↔ JSON description of the request
- **user-agent parse** (dep)
- **mime type lookup** (quick) — extension ↔ MIME
- **semver** (quick) — validate, compare against a param, sort a list of versions
- **regex explain** (dep or hand-rolled) — plain-English breakdown of a pattern
- **float ↔ IEEE 754 bits** (quick) — the classic 0.1+0.2 debugging tool
- **two's complement / bit ops** (quick) — AND/OR/XOR/NOT/shift with a mask param
- **hex dump** (quick) — xxd-style offset + hex + ASCII view of bytes; the natural `produces: bytes` viewer

---

## 8. Pipeline & engine features

- **Shareable pipeline URLs** — encode steps (+ optionally input) into the hash, LZ-string-compressed. The single highest-leverage feature: turns every pipeline into a link you can send a coworker.
- **Named pipeline library** — save/load/rename multiple pipelines (persist currently stores exactly one); export/import all as JSON.
- **Preset gallery** — shipped example pipelines: "Decode JWT", "Mojibake fixer", "CSV → JSON", "URL decoder chain", "Password generator". Doubles as onboarding.
- **Magic / auto-detect** (CyberChef's killer feature) — button that inspects the input (or any step's output), guesses the encoding, and suggests or auto-appends the decoding step; "keep decoding until stable" mode.
- **Second input per step** (arch) — a `textarea`/file param kind so diff, set-ops, and templates work: union/intersection/difference of two lists, diff two texts, checksum-verify.
- **Conditional steps** — run step only if a regex matches / input is non-empty; else pass through.
- **Branching** — fork the pipeline, run branches in parallel, merge (concat / zip / pick); linear → DAG (arch).
- **Composite steps / macros** — collapse a sub-chain into one named reusable step; share those too.
- **Custom JS step** — user-authored `(input, params) => output` run in a sandboxed Web Worker; the `code` ParamSpec already exists, this is the utility to exploit it.
- **Per-step diff preview** — highlight what changed between a step's input and output.
- **Step error policy** — per-step choice: fail pipeline vs pass through vs empty output; show error inline (partially exists) with the offending step highlighted.
- **Undo/redo** for pipeline edits.
- **Duplicate step**, **disable-all/solo step**, drag-and-drop reordering.
- **Step timing** — ms per step in previews; auto-debounce heavy steps.
- **Web Worker execution** (arch) — run the whole pipeline off the main thread; required for big inputs, gzip, hashing large files.
- **Streaming/chunked mode** for multi-MB inputs, with a size guard and "preview first 64 KB" toggle.
- **Cancellation** — pass AbortSignal into `apply` so stale runs stop (arch, small).

## 9. Param & type-system upgrades

- **New ParamSpec kinds**: `textarea` (multi-line), `regex` (validated, with flag checkboxes and live match count), `keyvalue` (list of pairs — needed for multi-replace, tr, headers), `file`, `color`, `date`, `multiselect`, `range` slider.
- **Param validation** — per-spec `validate(value) => string | null`, inline error display, min/max on numbers.
- **First-class `json` value type** — `accepts`/`produces` currently only model string/bytes; JSON flows through coercion invisibly. Make it explicit so the picker can filter compatible steps.
- **Fix `ValueType`** — `src/types/utility.ts:1` uses the `String` *wrapper type* (`String | Uint8Array`); should be a literal union `'string' | 'bytes' | 'json'`. Currently accepts/produces are effectively untyped.
- **Type-aware picker** — grey out or badge utilities whose `accepts` doesn't match the previous step's `produces`.
- **Utility metadata** — `tags`, `aliases`, `examples: {input, params, output}[]` per utility; powers search, docs pages, and doubles as test fixtures.
- **Lazy-load heavy utilities** — dynamic import per utility (glob already supports it) so wasm/dep-heavy tools don't bloat the initial bundle.

## 10. Input / output & editor UX

- **File upload as input** — text and binary (drag-drop + picker); with `get_bytes` this unlocks file hashing, base64-ing images, data-URI building.
- **Download with smart filename/MIME** — detect JSON/CSV/etc. and name the file accordingly (currently always `result.txt`).
- **Fetch URL as input** — via a Cloudflare Worker proxy endpoint (already deployed on Workers, so CORS is solvable).
- **Syntax highlighting of output** — CodeMirror is already a dependency; highlight JSON/XML/CSV by detected type; hex view toggle for byte outputs.
- **Output stats bar** — chars / words / lines / bytes always visible.
- **Input history** — recent inputs (ring buffer in IndexedDB), restore on click.
- **Side-by-side view** — input left, output right, optional diff overlay.
- **Copy per preview** (each step), copy-as: raw, JSON string literal, hex.
- **Clipboard-in button** and optional "auto-run on paste".
- **Line/column indicator** and go-to-line in the editors.

## 11. App & discoverability UX

- **Command palette (Ctrl+K)** — fuzzy-add any utility, jump to actions.
- **Fuzzy search in the picker** with keyboard navigation; match on name, tags, aliases ("uppercase" should find `case`).
- **Favorites & recently used** utilities pinned at top of picker.
- **Keyboard shortcuts** — add step, toggle previews, copy result, run.
- **Dark/light theme toggle** honoring `prefers-color-scheme`.
- **Responsive/mobile layout** — pipelines as a vertical accordion on small screens.
- **Accessibility pass** — focus management in picker/modals, ARIA on step controls, reduced-motion support for Framer/BackgroundFX.
- **Per-utility doc pages** — `#/util/:id` route with description, params, live mini-playground, examples (generated from utility metadata); great SEO surface tying into the blog.
- **Empty-state onboarding** — "paste something and we'll suggest a pipeline" (uses detect-format).
- **i18n** scaffold if there's ever an audience for it.

## 12. Platform & distribution

- **PWA** — offline support, installable; register as a **share target** so OS-level "Share → String Utility Belt" pipes text in.
- **Extract core package** (arch) — move `src/utilities` into a framework-free `@string-utility-belt/core`; the app, and everything below, consumes it:
  - **CLI** — `npx subelt trim base64 sha256 < file`; pipelines as shell one-liners.
  - **HTTP API on the existing Worker** — `POST /api/run` with `{input, steps}` → result; makes every pipeline curl-able and unlocks webhook use.
  - **MCP server** — expose utilities/pipelines as tools for AI agents; very current, near-free once the API exists.
  - **Browser extension** — context menu "run pipeline on selection".
  - **Raycast / Alfred / VS Code extension** — same core, new surfaces.
- **Embed mode** — `#/embed?pipeline=...` minimal iframe-able widget for blog posts.
- **URL-state versioning** — schema version + migration for persisted/shared pipelines so old links keep working.

## 13. Quality, testing & infra

- **Round-trip property tests** (dep — fast-check) — `decode(encode(x)) === x` for every encoder pair, arbitrary Unicode; the highest-value test class for this codebase.
- **Golden example tests** — run every utility's `examples` metadata as a test suite automatically.
- **E2E tests** (dep — Playwright) — build a pipeline, check preview, persist/reload, share-URL round-trip.
- **Bundle-size budget in CI** and per-utility code-splitting verification.
- **Benchmark suite** for large-input performance regressions.
- **Type-check in CI** (`tsc --noEmit`) alongside test+build if not already present.
- **RSS feed + changelog page** for the blog; auto-post "new utility" entries.
- **Sitemap + OG images** per utility page once doc routes exist.

---

## Suggested priority order

1. **Share-URL + named pipeline library + preset gallery** (§8) — multiplies the value of everything else.
2. **Cheap high-demand utilities** — grep lines, JWT decode, timestamp convert, uuid, gzip, json↔csv, sort-mode upgrades, line prefix/suffix, tabs↔spaces, strip-invisible-chars, hmac, base32, hex dump.
3. **Type-system fixes + new param kinds** (§9) — unblocks diff/set-ops/multi-replace and the type-aware picker.
4. **Magic detect + file input + worker execution** (§8, §10) — the CyberChef-tier differentiators.
5. **Core package extraction → API → CLI → MCP** (§12) — turns a web toy into a platform.
