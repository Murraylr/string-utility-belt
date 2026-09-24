# String Utility Belt

Chain string transformations into visual pipelines with live, per-step previews. 246 utilities —
encodings, hashes, ciphers, compression, data formats (JSON/YAML/TOML/CSV/XML), line and text
operations, analysis, generators, web/dev helpers, numbers, dates and colours — all running
client-side, with the same engine available as a CLI, an HTTP API, an MCP server, a browser
extension and a VS Code extension.

## Features

- **Pipelines** — add, reorder (drag and drop), duplicate, disable/solo steps; undo/redo; per-step
  previews, diffs, timings and error policies (pass through / stop / empty); conditional steps;
  parallel branches with concat/zip/json/pick merges; macros (collapse a sub-chain into one step).
- **Share and save** — pipelines (and optionally the input) as compressed `#/p/…` links, a named
  pipeline library with JSON import/export, a preset gallery, an embeddable `#/embed/…` widget.
- **Magic** — detects the input's format (base64, JWT, gzip, JSON, …) and suggests or appends the
  decoding step; "decode until stable" mode.
- **Input/output** — file upload (text and binary), fetch-a-URL via the Worker proxy, input history,
  side-by-side and diff views, hex view for bytes, syntax highlighting, stats bar, smart download
  names, copy-as (raw / JSON literal / hex / base64).
- **Engine** — runs in a Web Worker with cancellation, adaptive debounce, a chunked mode for
  multi-MB inputs and a preview-first-64 KB option; custom JavaScript steps run in a sandboxed,
  network-less iframe + worker, and are quarantined when they arrive from someone else's link.
- **App** — command palette (Ctrl+K), keyboard shortcuts (`?`), fuzzy utility search with
  favourites/recents and type-aware badges, light/dark themes, per-utility doc pages with a live
  playground, installable PWA with offline support and an OS share target, i18n scaffold.

## Development

```bash
npm install
npm run dev          # generates the utility manifest, then starts Vite
npm test             # Vitest (unit, component, golden-example and property tests)
npm run lint
npm run typecheck
```

| Command | What it does |
| --- | --- |
| `npm run gen` | Regenerate `src/utilities/_generated/*` (run automatically before `dev`/`build`) |
| `npm run build` | Production build of the web app |
| `npm run check:bundle` | Enforce the entry-chunk budget in `bundle-budget.json` |
| `npm run build:seo` | Pre-render utility pages, sitemap, RSS and OG images into `dist/` (`build:seo:fast` skips OG images) |
| `npm run build:site` | `build` + `build:seo` |
| `npm run build:tools` | Build `packages/*` (core, CLI, MCP server, browser extension, VS Code extension) |
| `npm run test:e2e` | Playwright end-to-end tests against a production build |
| `npm run bench` | Large-input benchmarks (`vitest bench`) |
| `npm run deploy` | `build:site`, then `wrangler deploy` (Cloudflare Workers: static assets + `/api/*`) |

## Other surfaces

| Surface | Where | Notes |
| --- | --- | --- |
| Core library | [`packages/core`](packages/core/README.md) | Framework-free engine + all utilities |
| CLI | [`packages/cli`](packages/cli/README.md) | `echo -n hello \| subelt base64_encode` |
| MCP server | [`packages/mcp`](packages/mcp/README.md) | Utilities and pipelines as agent tools over stdio |
| HTTP API | [`worker/`](worker/api.ts) | `POST /api/run`, `GET /api/utilities[/:id]` (CORS, rate-limited) |
| Browser extension | [`packages/extension`](packages/extension/README.md) | MV3; context menu "run on selection" |
| VS Code extension | [`packages/vscode`](packages/vscode/README.md) | Transform selection, run a share link |

## Adding a utility

Create `src/utilities/<id>/index.ts` with a default-exported `Utility` (see
[`src/types/utility.ts`](src/types/utility.ts)) and a colocated `index.test.ts`, then run
`npm run gen`. Every utility needs a description, at least three lowercase `tags` and at least one
worked `example` (examples run as tests and render on the doc page). See [CLAUDE.md](CLAUDE.md) for
the conventions.
