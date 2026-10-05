# Contributing to String Utility Belt

Thanks for helping out! Bug reports, utility ideas, documentation fixes and pull requests are all
welcome. This guide covers how to get set up and what a pull request needs before it can be merged.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Please report security
problems privately as described in [SECURITY.md](SECURITY.md) — not in a public issue.

## Ways to contribute

- **Report a bug** — open an issue with the bug template. A share link (`#/p/…`) of the failing
  pipeline is the fastest way to show the problem; leave the input out if it is private.
- **Suggest a utility** — open an issue with the utility request template, ideally with a short
  example input and the output you expect.
- **Send a pull request** — for anything bigger than a small fix, open an issue first so we can agree
  on the approach before you spend time on it.

## Development setup

You need **Node.js 20.19+ or 22.12+** (Vite 7's minimum) and npm.

```bash
git clone https://github.com/Murraylr/string-utility-belt.git
cd string-utility-belt
npm ci
npm run dev        # regenerates the utility manifest, then starts Vite on http://localhost:5173
```

The checks CI runs on every pull request:

```bash
npm test           # Vitest: unit, component, golden-example and property tests (incl. packages/ and worker/)
npm run typecheck  # tsc --noEmit for the app and scripts
npm run lint       # ESLint
npm run build      # production build (then npm run check:bundle enforces bundle-budget.json)
npm run test:e2e   # Playwright against a production build (first run: npx playwright install chromium)
```

CI also type-checks `tsconfig.worker.json`, `e2e/`, `bench/` and each `packages/*/tsconfig.json`, and
builds and tests the packages with `npm run build:tools`. See
[`.github/workflows/ci.yml`](.github/workflows/ci.yml) for the exact commands.

The repository uses LF line endings everywhere (enforced by `.gitattributes`). If you cloned before
that file existed on Windows and `src/utilities/_generated/generated.test.ts` fails, run `npm run gen`.

## Project layout

| Path | What lives there |
| --- | --- |
| `src/core/` | The framework-free pipeline engine (relative imports only, no DOM or React) |
| `src/utilities/<id>/` | One directory per utility: `index.ts`, `index.test.ts`, `guide.md` |
| `src/utilities/_generated/` | Manifest, loaders and examples written by `npm run gen` — never edit by hand |
| `src/app/`, `src/components/` | The React app |
| `worker/` | The Cloudflare Worker: the `/api/*` HTTP API and the static site |
| `packages/` | Core library, CLI, MCP server, browser extension and VS Code extension |
| `scripts/` | Code generation, SEO pre-rendering, bundle checks and Vite plugins |
| `e2e/`, `bench/` | Playwright tests and `vitest bench` benchmarks |

[CLAUDE.md](CLAUDE.md) is the detailed architecture reference (it doubles as context for AI coding
assistants) — read the sections relevant to your change.

## Adding a utility

Every utility lives in its own directory, `src/utilities/<id>/`, where `<id>` is `snake_case`.

1. **`index.ts`** — default-export a `Utility` (see [`src/types/utility.ts`](src/types/utility.ts)):

   ```ts
   import type { Utility } from '@/types/utility'

   const util: Utility = {
     id: 'my_util',
     name: 'my util',
     category: 'String Ops',
     description: 'What it does, in one sentence.',
     accepts: 'string',
     produces: 'string',
     tags: ['keyword', 'synonym', 'use case'],
     examples: [{ title: 'basic', input: 'abc', output: 'abc' }],
     params: {
       option: { kind: 'boolean', label: 'some option', default: false }
     },
     apply: (input: any, { option }: any) => String(input)
   }
   export default util
   ```

2. **`index.test.ts`** — colocated tests, including edge cases (empty input, Unicode, bad params).
   Round-trip encoder/decoder pairs also get a fast-check property in
   `src/utilities/__properties__/`.
3. **`guide.md`** — the SEO guide rendered on the utility's doc page. Follow
   [`base64_encode/guide.md`](src/utilities/base64_encode/guide.md) and
   [`pad/guide.md`](src/utilities/pad/guide.md); check it with `npm run check:guides -- <id>`.
4. **`npm run gen`** — regenerates `src/utilities/_generated/` (the test suite fails if you forget).

The registry tests enforce that every utility has a description, at least three lowercase `tags`, at
least one `example` (examples run as golden tests and render on the doc page) and a `max` on any number
or range param that multiplies output size or work.

Two rules that are easy to miss:

- **Third-party libraries are loaded lazily.** Import a dependency with `await import(...)` inside
  `apply`, cached in a module-level variable — never with a top-level `import`. The CLI, MCP server,
  Worker and extensions bundle every utility module, so a static import bloats all of them.
- **Never import `src/utilities/index.ts` from app code.** It eagerly loads every utility and exists for
  tests and Node only; the app uses the lazy registry in `src/app/registry.ts`.

## Code style

- TypeScript for new code. `@/` maps to `src/`, except inside `src/core/`, which uses relative imports
  so the packages can consume it.
- Match the surrounding code: naming, comment density and idioms. ESLint is the source of truth for
  formatting-level rules.
- Tests are colocated with the code they cover (`X.test.ts` / `X.test.tsx` next to `X.ts`).
- Keep pull requests focused: one feature or fix per PR, with tests. Don't mix refactors into a fix.
- Analytics events (`src/app/analytics/`) may carry ids, counts and size buckets — never input or
  output text. If a change alters what data leaves the browser, update
  [the privacy policy](src/app/pages/content/privacy.md) in the same PR.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change with tests, then run `npm test`, `npm run typecheck` and `npm run lint`.
3. Add an entry under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md) for user-visible changes.
4. Open the pull request and fill in the template. CI must be green before review.

Commit messages are written in the imperative mood and describe the change and its reason
("Reject out-of-range widths in pad" rather than "fixed bug").

## License

By contributing you agree that your contributions are licensed under the project's
[MIT License](LICENSE).
