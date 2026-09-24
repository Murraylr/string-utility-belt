# String Utility Belt

A React app for chaining string transformations into visual pipelines with live previews — plus the
same engine shipped as a CLI, HTTP API, MCP server, browser extension and VS Code extension.

## Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS (design tokens as CSS vars, `.dark` class), Framer Motion, CodeMirror (lazy)
- **Build:** Vite 7 with `@vitejs/plugin-react`; custom plugins in `scripts/` (utility manifest, PWA service worker)
- **Deploy:** Cloudflare Workers via Wrangler — static assets + the `/api/*` Worker (`npm run deploy`)
- **Tests:** Vitest + Testing Library + jsdom, fast-check property tests, Playwright E2E, `vitest bench`
- **Lint:** ESLint 9 flat config with typescript-eslint, react-hooks, react-refresh

## Commands

```bash
npm run dev          # gen + Vite dev server (port 5173 may be taken; launch.json uses autoPort)
npm test             # vitest run (all tests, incl. packages/ and worker/)
npm run typecheck    # tsc --noEmit (CI also checks tsconfig.worker.json and each packages/*/tsconfig.json)
npm run lint         # ESLint
npm run gen          # regenerate src/utilities/_generated/* (predev/prebuild run it)
npm run build        # production build; npm run check:bundle enforces bundle-budget.json
npm run build:seo    # pre-rendered /util/<id>/ pages, sitemap, RSS, OG images (build:seo:fast skips OG)
npm run build:tools  # packages/{core,cli,mcp,extension,vscode}
npm run test:e2e     # Playwright against a production build
npm run deploy       # build:site (build + build:seo) + wrangler deploy
```

## Architecture

### Core engine (`src/core/`)
- Framework-free: relative imports only, no DOM/React. Consumed by the app, the Worker API and every package.
- `coerce` (value types, `coerceInputFor`, `isBytes`, display formatting), `params` (resolve defaults,
  declarative validation), `registry` (metadata + lazy loader, env/capability checks), `runner`
  (`runPipeline(source, steps, { load, previews, signal, env, onStep })`), `serialize` (schema v2,
  migration, `#/p/…` share links bounded by `MAX_SHARE_CHARS`), `steps`, `sandbox`, `streaming`, `detect`.
- The runner enforces declared number/range bounds as step errors and caps any step's output at
  `MAX_VALUE_SIZE` (64 MiB). Steps can be utility steps, `branch` steps (parallel, merged
  concat/zip/json/pick) or `macro` steps, each with an optional `condition` and `onError` policy
  (`passthrough` default, `stop`, `empty`).

### Utility system (`src/utilities/`)
- Each utility lives in `src/utilities/<id>/index.ts` as a default export of type `Utility`.
- `scripts/gen-utilities.ts` (`npm run gen`) writes `src/utilities/_generated/`: `manifest.ts`
  (metadata only), `loaders.ts` (one dynamic import per utility), `examples.ts`, `static.ts`.
  `generated.test.ts` fails when these are stale.
- Three registries — pick the right one:
  - `src/utilities/lazy.ts` (`registry`, re-exported from `src/app/registry.ts`) — **the web app**. Metadata up front, code per chunk.
  - `src/utilities/static-registry.ts` — CLI, MCP, Worker, extensions (no `import.meta.glob`).
  - `src/utilities/index.ts` (`UTILITIES`, `UTIL_MAP`, back-compat `runPipeline(source, steps, wantPreviews)`) — **tests and Node only**. Never import it from app code: it pulls every utility into the entry chunk.
- `Utility` (`src/types/utility.ts`): `id`, `name`, `category`, `description`, `accepts`, `produces`,
  `params`, `tags`, `aliases`, `examples`, `env` (`dom`/`wasm`/`eval`/`main` capability flags, detected
  by the generator), `streamable`, `apply(input, params, ctx?)` where `ctx` carries `signal` and `env`.
- `ValueType` is `'string' | 'bytes' | 'json'`; values coerce automatically between steps.
- `ParamSpec` kinds: `string`, `number`, `boolean`, `select`, `code`, `textarea`, `regex`, `keyvalue`,
  `file`, `color`, `date`, `multiselect`, `range`. Numbers/ranges that multiply output size or work
  (counts, widths, iterations) must declare `max` — the runner rejects out-of-range values.

### App (`src/app/`)
- `AppShell.tsx` — header/nav, lazy route pages, command palette, shortcuts help, theme, PWA install/update, frame-busting.
- `ToolContext.tsx` + `store/pipeline.ts` — pure reducer with undo/redo (coalesced edits); persisted pipeline.
- `tool/` (tool page, IO panels, step list), `engine/` (Web Worker execution, chunked mode, cancellation,
  adaptive debounce), `io/` (file/fetch input, history, diff/hex/output views, stats, download),
  `share/` (share links, `trust.ts` quarantines `custom_js` from links), `sandbox/` (custom JS runs in a
  sandboxed iframe + worker), `library/` (named pipelines, presets), `magic/` (auto-detect),
  `search/`, `commands/`, `pages/` (utility index/doc pages, embed, changelog), `pwa/`, `i18n/`, `theme/`.
- Components in `src/components/` (`StepCard`, `UtilityPicker`, `ParamsEditor` + `params/*` per kind, `CopyAsMenu`, …).

### Routing (`src/lib/router.ts`)
- Hash routes: `#/` home, `#/p/<payload>` shared pipeline, `#/embed/<payload>`, `#/utilities`,
  `#/util/:id`, `#/blog`, `#/blog/:slug`, `#/changelog`.
- A page with no hash routes by its pathname (pre-rendered `/util/<id>/`, `/utilities/`, `/blog/…`).

### State
- Pipeline config persisted to localStorage under `string-utility-belt` (`src/lib/persist.ts`).
- Library under `sub:library`; preferences under `sub:pref:<name>` (theme, locale, favorites, recents).

### Worker (`worker/`) and packages (`packages/`)
- `worker/api.ts`: `POST /api/run`, `GET /api/utilities[/:id]` (public CORS, rate-limited, per-request
  budget), `GET /api/fetch?url=` (same-origin fetch proxy with SSRF guards). Everything else is static assets.
- `packages/core` is a build artifact over `src/core` + the static registry; `cli` (`subelt`), `mcp`
  (stdio server; runs jobs in killable child processes), `extension` (MV3), `vscode`. Each has a README.

## Categories

`Encoding`, `Decoding`, `Hashing`, `Ciphers`, `Compression`, `Data Formats`, `String Ops`,
`Lines`, `Formatting`, `Analysis`, `Generators`, `Web & Dev`, `Numbers`, `Date & Time`, `Color`
(plus the legacy `URL & JSON` used by the original url/json utilities).

Any dependency (`yaml`, `smol-toml`, `turndown`, `marked`, `sql-formatter`, `diff`, `cronstrue`,
`hash-wasm`, `qrcode-generator`, `franc-min`, `ua-parser-js`, `pluralize`, `fflate`, `brotli`) MUST be
loaded with a dynamic `await import(...)` inside `apply`, cached in a module-level variable — never a
top-level static import. The static registry and the eager test registry import every utility module,
so a static import would bloat every non-browser host and the per-utility chunks.

## Adding a new utility

1. Create `src/utilities/<id>/index.ts` exporting a default `Utility` object
2. Create `src/utilities/<id>/index.test.ts` with tests
3. Run `npm run gen` (dev/build do it automatically; the test suite fails if you forget)

Registry tests require: a description, ≥3 lowercase `tags`, ≥1 `example` whose params pass validation
(examples run as golden tests and render on the doc page), and a `max` on amplifying number params.

```ts
import type { Utility } from '@/types/utility'

const util: Utility = {
  id: 'my_util',
  name: 'my util',
  category: 'String Ops',  // see the category list above
  description: 'What it does, in one sentence.',
  accepts: 'string',
  produces: 'string',
  tags: ['keyword', 'synonym', 'use case'],
  examples: [{ title: 'basic', input: 'abc', output: 'abc' }],
  params: {
    option: { kind: 'boolean', label: 'some option', default: false }
  },
  apply: (input: any, { option }: any) => {
    return String(input)
  }
}
export default util
```

## CI

GitHub Actions (`.github/workflows/ci.yml`): tests, typecheck (app, worker, e2e, packages), lint, build +
`check:bundle` + `build:seo:fast`, `build:tools` + package tests, `wrangler deploy --dry-run`, and Playwright.

## Path aliases

`@/` maps to `src/` (configured in Vite/tsconfig). Code under `src/core/` must use relative imports.

## Conventions

- Tests are colocated: `src/utilities/<id>/index.test.ts`, `src/app/**/X.test.tsx`, `src/components/<Name>.test.jsx`
- Both `.ts` and `.tsx` utility modules are supported
- Utility `apply` functions receive `(input: any, params: any, ctx?)` — cast input with `String(input)` for string utilities
- Round-trip encoder/decoder pairs belong in `src/utilities/__properties__/` (fast-check)
