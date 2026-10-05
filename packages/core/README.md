# @string-utility-belt/core

The framework-free pipeline engine behind [String Utility Belt](https://stringutilitybelt.com) ([source](https://github.com/Murraylr/string-utility-belt)),
plus all of its 246 string/data utilities, packaged for use outside the browser:
Node scripts, servers, CLIs, other bundlers.

It has no dependency on React, the DOM, or the web app — it's the same engine
the app itself runs on (`src/core/**`), bundled here with a static, eagerly
loaded registry of every utility instead of the app's lazy, chunk-per-utility
one.

## Install

```bash
npm install @string-utility-belt/core
```

Requires Node.js 20 or later. To build it from a checkout of the
[monorepo](https://github.com/Murraylr/string-utility-belt) instead:

```bash
npm run build:core                       # emits dist/index.mjs (+ lazily loaded chunks)
npx tsc -p packages/core/tsconfig.json   # emits dist/types/**/*.d.ts
```

The two steps are independent and can run in either order (the JS build clears
`dist/` but leaves `dist/types/` alone). `dist/` is self-contained: every
dependency is bundled, only Node built-ins are imported.

Then `import` it by path, or `npm link` the `packages/core` directory.

## Quick start

```ts
import { run } from '@string-utility-belt/core'

// A bare list of steps — id is any string, unique within the pipeline.
const result = await run('  hello world  ', [
  { id: 'a', utilityId: 'trim' },
  { id: 'b', utilityId: 'base64_encode' },
])
console.log(result.out) // 'aGVsbG8gd29ybGQ='
```

`run` accepts three shapes for `pipeline`:

```ts
// 1. A bare step array (as above).
await run(input, [{ id: 'a', utilityId: 'trim' }])

// 2. A full PipelineDoc (what the app saves/exports/shares).
await run(input, { v: 2, steps: [{ id: 'a', utilityId: 'trim' }] })

// 3. A share payload or a full share URL — the part after `#/p/` (or `#/embed/`)
//    is decoded with decodeShare(), percent-decoded first if a chat app escaped it.
await run(input, 'https://stringutilitybelt.com/#/p/N4IgdghgtgpiBc...')
await run(input, 'N4IgdghgtgpiBc...')
```

If `input` is `undefined`, the document's own `input` field is used (present
when a pipeline was shared/saved with its sample input attached); otherwise
the source starts as `''`.

`run` throws *before* executing anything if the pipeline contains a step this
environment can't run:

- an unknown utility id;
- a step needing the browser main thread (`env` includes `main`) — notably
  `custom_js`, which is always refused here because `run` registers no sandbox;
- a step needing a DOM (`html_to_markdown`, `html_table_to_csv`, `xml_to_json`)
  when there are no `DOMParser`/`document` globals. Install jsdom's `window.DOMParser`
  and `window.document` on `globalThis` first if you need those.

Step *failures* while running do not throw: they are recorded per step in
`result.err`, and each step's `onError` policy decides what flows on.

If you need custom-JS steps, call `runPipeline` yourself after registering a
`Sandbox` (see below) — this is what `subelt --allow-custom-js` (the CLI in
`packages/cli`) does.

## Lower-level API

Everything in `src/core/**` is re-exported as-is: `runPipeline`, `coerceInputFor`,
`valueType`, `asText`, `formatForDisplay`, `resolveParams`, `validateParams`,
`createRegistry`, `unsupportedSteps`, `canRunInWorker`, `sanitizeSteps`,
`migratePipeline`, `encodeShare`, `decodeShare`, `walkSteps`, `findStep`,
`updateStep`, and the `setSandbox`/`getSandbox` pair for `custom_js`. See
`src/core/index.ts` for the full list, and `src/types/utility.ts` for the
`Utility`/`PipelineStep`/`PipelineDoc` types.

```ts
import {
  runPipeline, staticRegistry, setSandbox, type Sandbox,
} from '@string-utility-belt/core'

// Enable custom_js by registering a sandbox for your host (this package does
// not ship one — running arbitrary JS needs a host-specific containment
// strategy; see packages/cli/src/sandbox-node.ts for a worker-thread + node:vm
// example, with its "this is not a security boundary" caveat).
setSandbox(mySandbox as Sandbox)

const result = await runPipeline(input, steps, {
  load: id => staticRegistry.load(id),
  previews: true,
  env: 'node',
})
```

`staticRegistry` implements the same `Registry` interface the web app uses
(`list()`, `get(id)`, `has(id)`, `categories()`, `byCategory()`, `load(id)`),
except every utility's code is already in memory — `load` never fetches
anything. `STATIC_UTILITIES` is the raw array of `Utility` objects, in case
you want to build your own registry or index.

## Verify a build

```bash
npm run build:core
node -e "import('./packages/core/dist/index.mjs').then(async m => \
  console.log((await m.run('  hi  ', [{ id: 'a', utilityId: 'trim' }])).out))"
# -> hi
```
