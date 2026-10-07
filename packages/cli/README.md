# subelt

Run a [String Utility Belt](https://stringutilitybelt.com/?utm_source=npm&utm_medium=referral&utm_campaign=subelt) pipeline from the shell — the same 246
utilities and pipeline engine as the web app, built on
[`@string-utility-belt/core`](https://www.npmjs.com/package/@string-utility-belt/core).

```bash
npm install -g subelt        # or run it without installing: npx subelt …
echo hi | subelt base64_encode
# aGkK
```

Requires Node.js 20 or later. From a checkout of the [monorepo](https://github.com/String-Utility-Belt/string-utility-belt), build and
run it in place instead:

```bash
npm run build:cli
echo hi | node packages/cli/dist/subelt.mjs base64_encode
```

## Usage

```
subelt [options] <step>...
```

A **step** is a utility id, or `utility_id:key=value,key2=value2`. Values are
converted according to the utility's own param kind:

- `number` / `range` → `Number(value)`
- `boolean` → `true`/`1`/`yes` → `true`, `false`/`0`/`no` → `false`
- `multiselect` / `keyvalue` → JSON (`[...]`/`{...}`) if the value looks like
  it, otherwise a comma list that runs on until the next known param
  (`keyvalue` pairs split on `:` or `=`, whichever comes first):
  `extract_preset:type=urls,emails,unique=true`,
  `multi_replace:rules=colour:color,grey:gray`
- everything else (`string`, `select`, `code`, `regex`, `color`, `date`, …) →
  the text as given

A backslash escapes a literal comma inside a value: `split_join:joinWith=\,`
(inside a list item too: `multi_replace:rules=a\,b:c`). A value that starts
with `[` or `{` is taken whole up to its matching bracket, so JSON — and a
regex character class like `replace:pattern=[,;],replacement=-` — needs no
escaping. Quotes and apostrophes are ordinary characters
(`replace:pattern=don't,replacement=do not`).

Unknown utility ids (with "did you mean" suggestions), unknown or repeated
param keys, and invalid values (a bad number, an option not in a `select`'s
list, an out-of-range number, an invalid regex, …) are all reported
immediately with the valid keys/options listed, and exit with code 2.

### Input — pick one (default: stdin)

- `-i, --input <file>` — read the input from a file
- `-t, --text <string>` — use this literal string as input
- `-b, --bytes` — pass stdin / `-i` input to the pipeline as raw bytes, undecoded

Otherwise piped stdin and `-i` files follow the web app's text test: input that
is valid UTF-8 with no binary control bytes becomes a **string** (a BOM is
kept); anything else stays raw **bytes**, so binary files (images, gzip
streams, protobuf messages, …) pass through exactly. This matters for
utilities that accept both: `echo -n hello | subelt md5` prints the hex digest
just like the app, while `subelt -i photo.png md5` (or `subelt --bytes md5`)
yields the raw digest bytes (add `hex_encode`). `-t` always gives a string.

When stdin is a terminal (nothing piped in), a `--pipeline`/`--share` document
that carries its own sample `input` uses that; otherwise subelt says on stderr
that it is waiting for you to type (end with Ctrl-D, or Ctrl-Z Enter on
Windows).

### Pipeline source — pick one (default: the step arguments)

- `-p, --pipeline <file.json>` — a `PipelineDoc` JSON file (`{v, steps, …}`),
  or a library export (`exportLibrary()`'s `{v, entries}`) — pick which entry
  with `--name <name-or-id>` (required when the file has more than one entry).
  A file from a newer schema version is refused.
- `-s, --share <url-or-payload>` — a share link (`https://…/#/p/<payload>` or
  `…/#/embed/<payload>`, percent-encoded or not) or the bare payload

### Output

- `-o, --output <file>` — write the result to a file instead of stdout
- `--json` — print the run's `RunResult` summary as JSON (`out`, `err`,
  `skipped`, `halted`, `aborted`, `timings`, and — with `--previews` — every
  step's `previews`/`inputs`); bytes become `{ "type": "bytes", "base64": … }`
- `--previews` — print every step's output to stderr as the pipeline runs
- `--display` — render `bytes` output with `formatForDisplay` (a readable
  `bytes[…]` / `hex: […]` / `utf8: …` block) instead of writing it raw

A `string` result is written as UTF-8 text, with a trailing newline added
only when stdout is a TTY (so `subelt trim | subelt md5` doesn't pick up
spurious newlines in a pipe). A `bytes` result is written raw (no added
newline, ever) unless `--display` is given. A `json`-typed result (an object
or array a utility produced, e.g. `csv_to_json`) is always pretty-printed.

### Utility lookup

- `--list [category]` — list utility ids, optionally filtered to one category
  (case-insensitive; an unknown category is a usage error listing the real ones)
- `--describe <id>` — one utility's description, `accepts`/`produces`,
  `env`, aliases, tags and full param list
- `--search <query>` — search ids, names, tags and aliases

### Custom JavaScript

- `--allow-custom-js` — allow the `custom_js` utility. Each run gets a fresh
  worker thread holding a `node:vm` context that exposes only `input` and a few
  safe globals (no `require`/`process`/`import`); the thread is killed when the
  step's `timeoutMs` runs out, so even an `await` loop that never yields stops
  on time. `console.*` from the code goes to stderr, never into the result.

  **`node:vm` is not a security boundary.** Any host object reachable from the
  context (the console bridge, `crypto`, `input` itself) leads back to a
  `Function` constructor and from there to `process`, with your user's full
  rights. It only guards against *accidental* mistakes — typos, infinite
  loops, reaching for `require` — on the assumption you already trust the
  code. Never point this at a pipeline you didn't write or haven't read. The
  CLI refuses `--allow-custom-js` together with `--share` outright; to run a
  shared pipeline's code, save it as a file, read it, and pass `--pipeline`.

  Without this flag, `custom_js` (and anything else needing the browser main
  thread or arbitrary code execution) is refused before anything runs.
  Utilities needing the DOM (`html_to_markdown`, `xml_to_json`, …) are always
  refused — there's no DOM in Node here.

### Other

- `-h, --help` / `-v, --version`

### Exit codes

- `0` — ok
- `1` — a step failed while the pipeline ran (its message is printed to
  stderr as `step 2 (get_bytes) failed: …`; nested steps as `step 2.1.3 (…)`).
  The output of the run is still written, per each step's `onError` policy
  (the default, `passthrough`, hands the failed step's input on unchanged).
- `2` — a usage error (bad flag, unknown utility, invalid param value, …)

## Examples

```bash
echo hi | subelt base64_encode
subelt -t 'a,b' csv_to_json
subelt --share 'https://stringutilitybelt.com/#/p/N4Ig…' < in.txt
subelt -i photo.png mime_from_magic
subelt -t hi get_bytes --display
subelt -p my-pipeline.json -i input.txt -o output.txt
echo hi | subelt --allow-custom-js 'custom_js:code=return input.toUpperCase()'
```

## Programmatic use

`main` (from `src/main.ts`) is the whole CLI minus process wiring — it takes
`argv` and an `io` object (`stdin`/`stdout`/`stderr`, plus `isTTY` for stdout
and `stdinIsTTY` for stdin) and returns an exit code, so it can be tested (or
reused) without touching real stdio; see `src/main.test.ts`.
`src/process-io.ts` builds that object from the real process (and ends quietly
when a reader such as `head` closes the pipe); `src/bin.ts` runs `main` with it
and sets `process.exitCode`.

## Build

```bash
npm run build:cli   # -> packages/cli/dist/subelt.mjs + dist/chunks/*.mjs
```

`dist/` is self-contained — every dependency is bundled and only Node
built-ins are imported, so the published package needs no `dependencies`. The
libraries utilities load on demand (yaml, sql-formatter, hash-wasm, …) stay in
their own chunks, so a run only parses what its steps use. Ship the whole
`dist/` directory (the package's `files` does).

## Source and issues

subelt is developed in the [String Utility Belt repository](https://github.com/String-Utility-Belt/string-utility-belt/tree/main/packages/cli) on GitHub,
alongside the web app and the other integrations. Report bugs or request features in its
[issue tracker](https://github.com/String-Utility-Belt/string-utility-belt/issues). MIT licensed.
