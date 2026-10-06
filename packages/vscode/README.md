# String Utility Belt for VS Code

Run String Utility Belt's string transforms — encoding, hashing, ciphers, formatting,
generators and more — directly on your editor selection, or replay a whole saved
pipeline, without leaving VS Code. Same engine and utilities as the [web app](https://stringutilitybelt.com/?utm_source=vscode_marketplace&utm_medium=referral&utm_campaign=vscode).

## Features

### Transform Selection… (`subelt.transform`, `Ctrl+Alt+U` / `Cmd+Alt+U`)

Pick a utility from a searchable list (name, category and description are all matched;
recently used ones come first), choose whether to use its default parameters or
customize them, and it runs on every selection in the active editor, replaced in a single
undoable edit.

- **Selections:** every non-empty selection is transformed. When there is no selection
  at all (only cursors), the whole document is transformed.
- **Parameters:** choices are picked from a list (the default is marked), yes/no
  switches from Yes/No, and numbers, text, regexes, colors and dates are typed into a
  prefilled box that validates as you type, with the same rules as the web app. A
  cleared number box means "use the default". A default containing a line break or tab
  is shown as `\n` / `\t`; accepting it unchanged keeps the real character. Key/value,
  multi-select and file parameters keep their defaults.
- **Results:** raw bytes are inserted as base64 (with a notice); JSON is inserted
  pretty-printed.
- **Errors** name the utility and leave the document untouched. If you edit the document
  while a slow transform is running, its result is discarded rather than pasted over
  your changes.
- Only utilities that can run in VS Code's Node-based extension host are offered — not
  those that need a browser DOM, the browser main thread, or `eval`.

### Repeat Last Transform (`subelt.repeatLast`)

Reruns the last successful transform, with the same parameters, on the current
selection(s).

### Run Pipeline (share link or JSON)… (`subelt.runPipeline`)

Runs a full saved pipeline (branches, macros, conditions and error policies included)
over each selection. The pipeline can come from:

- a pasted share URL (`…#/p/<payload>` or `…#/embed/<payload>`) or the bare payload, or
- a `.json` file — a single pipeline document, or a String Utility Belt library export
  (`{ entries: [...] }`), in which case you pick which saved pipeline to run.

Pipelines from links and files are untrusted: their steps are sanitized, and a pipeline
that uses a utility VS Code can't run — browser-only ones, custom JavaScript
(`custom_js`), or an unknown utility id — is refused with the list of offending
utilities, rather than run partially. If a step set to "stop on error" fails, nothing is
replaced; other step failures follow their error policy and are reported in a warning.

### Describe Utility… (`subelt.describe`)

Opens an untitled markdown document describing any utility: its parameters (labels,
defaults, options and limits), tags, aliases and worked examples. Browser-only
utilities are listed too, marked as such.

## Building and packaging

The extension is bundled with Vite into one self-contained CommonJS file — every
dependency except `vscode` itself is inlined, so no `node_modules` ship. From the repo
root:

```bash
npm run build:vscode   # -> packages/vscode/dist/extension.cjs
```

To produce an installable `.vsix`, package it with `vsce` (not a dependency of this
repo — `npx` downloads it on demand):

```bash
cd packages/vscode
npx @vscode/vsce package --no-dependencies
```

`vsce` reads `package.json` and `.vscodeignore` (an allowlist: only `dist/extension.cjs`,
its source map, `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE` and `icon.png` ship).
Build first: there is no `vscode:prepublish` script.

## Development

```bash
npm run build:vscode                                                      # build dist/extension.cjs
npx vitest run packages/vscode/src --minWorkers=1 --maxWorkers=2          # unit tests
npx tsc --noEmit -p packages/vscode/tsconfig.json                         # typecheck
```

The commands live in `src/commands.ts` and receive the `vscode` API as a parameter
(`src/extension.ts` is the thin entry that passes the real module in), so the tests drive
them with a small fake (`src/test-helpers/fake-vscode.ts`) and run under the repo's root
Vitest config as well as `packages/vscode/vitest.config.ts`. `src/dist-load.test.ts`
loads the built bundle with `vscode` stubbed and runs a pipeline through it; it is
skipped until `npm run build:vscode` has been run.

To try it in a real Extension Development Host, open this folder in VS Code and launch it
with `extensionDevelopmentPath` pointing here, or install the packaged `.vsix` via
"Extensions: Install from VSIX…".
