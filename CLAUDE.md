# String Utility Belt

A React app for chaining string transformations into visual pipelines with live previews — plus the
same engine shipped as a CLI, HTTP API, MCP server, browser extension and VS Code extension.

## Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS (design tokens as CSS vars, `.dark` class), Framer Motion, CodeMirror (lazy)
- **Build:** Vite 7 with `@vitejs/plugin-react`; custom plugins in `scripts/` (utility manifest, PWA service worker)
- **Deploy:** Cloudflare Workers via Wrangler — static assets + the `/api/*` Worker. Released by the Release workflow
  (see "Releases" below); `npm run deploy` is the manual fallback
- **Tests:** Vitest + Testing Library + jsdom, fast-check property tests, Playwright E2E, `vitest bench`
- **Lint:** ESLint 9 flat config with typescript-eslint, react-hooks, react-refresh

## Commands

```bash
npm run dev          # gen + Vite dev server (port 5173 may be taken; launch.json uses autoPort)
npm test             # vitest run (all tests, incl. packages/ and worker/)
npm run typecheck    # tsc --noEmit (CI also checks tsconfig.worker.json and each packages/*/tsconfig.json)
npm run lint         # ESLint
npm run gen          # regenerate src/utilities/_generated/* (predev/prebuild run it)
npm run build        # production build, then (postbuild) build:seo — OG images only in Workers Builds (WORKERS_CI);
                     # npm run check:bundle enforces bundle-budget.json
npm run build:seo    # pre-rendered pages (/util/<id>/, /docs/, site pages, 404.html), sitemap, RSS, OG images (build:seo:fast skips OG)
npm run check:guides -- <id…>  # check utility guides quickly (loads only those utilities; no ids = all)
npm run build:tools  # packages/{core,cli,mcp,extension,vscode}
npm run test:e2e     # Playwright against a production build
npm run deploy       # build:site (build + build:seo) + wrangler deploy (manual; releases deploy from CI)
npm run release -- plan   # what a release from HEAD would ship, at which versions (read-only; RELEASING.md)
```

## Architecture

### Core engine (`src/core/`)
- Framework-free: relative imports only, no DOM/React. Consumed by the app, the Worker API and every package.
- `coerce` (value types, `coerceInputFor`, `isBytes`, display formatting), `params` (resolve defaults,
  declarative validation), `registry` (metadata + lazy loader, env/capability checks), `runner`
  (`runPipeline(source, steps, { load, previews, signal, env, onStep })`), `serialize` (schema v2,
  migration, `#/p/…` share links bounded by `MAX_SHARE_CHARS`), `steps`, `sandbox`, `streaming`, `detect`.
- The runner enforces declared number/range bounds as step errors and caps any step's output at
  `MAX_VALUE_SIZE` (64 MiB; `maxValueSize` overrides it — the Worker uses 8 MiB), checking a branch's
  lanes before merging them. Steps can be utility steps, `branch` steps (parallel, merged
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

### Utility guides (SEO)
- Every utility has `src/utilities/<id>/guide.md`: frontmatter `title` (the page `<title>`, ≤ 60 chars) and
  `description` (meta description, 80–160), then `##` sections with ```` ```example ```` blocks. Format and
  parser: `src/app/pages/guide.ts`. Rules: `src/utilities/guideCheck.ts`, enforced by `guides.test.ts`
  (every example is executed like a golden example; links must be `/util/<id>/` paths to real utilities).
- Not bundled as JS: `scripts/vite-plugin-guides.ts` serves them at `/guides/<id>.md` in dev and emits
  them as assets in `vite build`. `UtilityDocPage` fetches its guide and shows it in a collapsed `<details>`
  (`UtilityGuide.tsx`); `scripts/seo/build.ts` pre-renders the same markup plus the guide's title/description
  into `/util/<id>/`. Related-utility and guide links use crawlable `/util/<id>/` hrefs with in-app
  navigation (`navigateToPath` in `src/lib/router.ts`).
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
  `#/util/:id`, `#/blog`, `#/blog/:slug`, `#/changelog`, `#/docs` (usage guide),
  `#/about` | `#/privacy` | `#/contact` (`SITE_PAGES`).
- A page with no hash routes by its pathname (pre-rendered `/util/<id>/`, `/utilities/`, `/docs/`, `/blog/…`, `/about/`…);
  any other non-root path is `notFound`: the tool with a "page not found" notice that sets `noindex`. The host answers
  it with `dist/404.html` and a 404 status (`not_found_handling: "404-page"`), so a new path-routed page must also be
  pre-rendered by `scripts/seo/build.ts`, or it 404s on a direct load.
- **Links use real paths, never `#/` routes** (search engines drop fragments): `href="/utilities/"`,
  `utilityPath(id)`, `/blog/<slug>/`. `AppShell`'s `useInAppLinks` turns plain clicks on any `isInAppPath`
  href into `navigateToPath` (pushState, no reload). It listens on `document`, so a link's click must bubble:
  a React `stopPropagation()` on it (or an ancestor) means a full page load. Hash routes still resolve for old links and commands.

### SEO & ads
- `src/app/pages/seo.ts` holds the search-facing strings both the app (`useDocumentMeta`) and the
  pre-render use — titles go through `pageTitle()` (site name only when it fits 60 chars). Change a
  title/description there, never in only one place: Google indexes the rendered page.
- Site pages: `src/app/pages/content/{about,privacy,contact}.md` (frontmatter title/description, guide
  markdown syntax, own `#` heading), rendered by `SitePage` and pre-rendered by `build.ts`. The privacy
  policy carries AdSense's required disclosures — keep it accurate when data flows change.
- Usage guide: `src/components/Docs.tsx` (`/docs/`), pre-rendered by `build.ts` with `renderToStaticMarkup` of the
  component itself — keep its render free of browser APIs (effects are fine).
- Ads: the AdSense loader and Consent Mode defaults live in `index.html` (ads are paused inside frames and
  `#/embed`). Manual units are `<AdSlot placement>` (`src/app/ads/`), inert until `AD_SLOTS` has unit ids.
  Content pages only; never in the pipeline editor or embed; never remount a unit without a navigation.

### Analytics (`src/app/analytics/analytics.ts`)
- GA4 property `G-EFVMEMB86E`. index.html only loads gtag.js and sets Consent Mode defaults; `initAnalytics()`
  (from `main.tsx`) configures the tag. Never add a `gtag('config')` to index.html: it would report
  `location.href`, and share links carry the user's input in the fragment.
- Page views are sent by the module from the router with canonical URLs (`/p/`, `/util/<id>/`, …; campaign
  params only) — GA's own history-based page views are off in the stream settings.
- Report features with `track()` / `trackUtilityAdd()` / `trackPipelineEvent()` / `trackInput()`: ids, formats,
  counts and size buckets only, never input/output text. New params need a custom dimension in GA
  (Admin → Custom definitions) to show in reports; keep the privacy policy's GA paragraph accurate.
- Silent off `stringutilitybelt.com` (dev, E2E, CI, previews). `?analytics=off|on|debug` switches a browser.
  Automation (webdriver/headless/bot UA) is reported as `visitor_type: automated`, page views only.

### State
- Pipeline config persisted to localStorage under `string-utility-belt` (`src/lib/persist.ts`).
- Library under `sub:library`; preferences under `sub:pref:<name>` (theme, locale, favorites, recents).

### Worker (`worker/`) and packages (`packages/`)
- `worker/api.ts`: `POST /api/run`, `GET /api/utilities[/:id]` (public CORS, rate-limited, per-request
  budget), `GET /api/fetch?url=` (same-origin fetch proxy with SSRF guards). Everything else is static assets.
- `packages/core` is a build artifact over `src/core` + the static registry; `cli` (`subelt`), `mcp`
  (stdio server; runs jobs in killable child processes), `extension` (MV3), `vscode`. Each has a README.
- App ↔ extension: `src/core/extensionBridge.ts` is the shared contract (messages, `BRIDGE_ORIGINS`, the store
  extension id, which utilities the extension can run). The extension is `externally_connectable` from those origins
  (no content script: a new install warning would disable the published extension); `src/app/extension/` pings it
  with `chrome.runtime.sendMessage` and shows "save to extension" only when it answers.

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
3. Create `src/utilities/<id>/guide.md` — the SEO guide for its doc page (see "Utility guides" above;
   `src/utilities/base64_encode/guide.md` and `src/utilities/pad/guide.md` are the references), then
   `npm run check:guides -- <id>`
4. Run `npm run gen` (dev/build do it automatically; the test suite fails if you forget)

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

## Releases (`RELEASING.md`)

- `.github/workflows/release.yml` runs after CI passes on `main`: it releases only the targets (`app`, `core`, `cli`,
  `mcp`, `extension`, `vscode`) whose shipped files changed since their last `<id>-v<version>` tag, bumps versions the
  merged PR didn't (patch; `release:minor` / `release:major` labels), pushes a `chore(release): … [skip ci]` commit,
  then deploys each target, tags it and creates a GitHub release. Every deploy checks its store first (idempotent).
- Tooling: `scripts/release.ts` + `scripts/release/`. Path rules per target live in `scripts/release/targets.ts`; a test
  walks each package's imports and fails when a bundled file isn't covered — extend the globs when a package starts
  importing from a new directory. `release-preview.yml` shows each PR's would-be release in its job summary.
- Versions: every version file of a target must agree (tested). The CLI's `VERSION` and the MCP server's version are
  imported from their `package.json`; the extension's version is `manifest.json` alone (no longer the root's).
  Raise a version by hand only to pick it yourself (all of the target's files at once); never lower one.

## Path aliases

`@/` maps to `src/` (configured in Vite/tsconfig). Code under `src/core/` must use relative imports.

## Conventions

- Tests are colocated: `src/utilities/<id>/index.test.ts`, `src/app/**/X.test.tsx`, `src/components/<Name>.test.jsx`
- Both `.ts` and `.tsx` utility modules are supported
- Utility `apply` functions receive `(input: any, params: any, ctx?)` — cast input with `String(input)` for string utilities
- Round-trip encoder/decoder pairs belong in `src/utilities/__properties__/` (fast-check)
