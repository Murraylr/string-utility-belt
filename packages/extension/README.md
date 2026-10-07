# String Utility Belt — browser extension

A Manifest V3 extension that runs String Utility Belt transformations on
selected text without opening the app: right-click a selection (or a text
field you're editing) → **String Utility Belt** → pick a favourite utility or
a saved pipeline.

- In an editable field (`<input>`, `<textarea>`, `contenteditable`) the result
  replaces the selection, caret after it; the page's undo (Ctrl+Z) still works.
  Right-clicking a text field with nothing selected applies the utility to the
  whole field.
- Anywhere else the result is copied to the clipboard and kept for the popup,
  which opens prefilled with it.
- If the utility fails (e.g. `json pretty` on text that isn't JSON), the page
  is left untouched; the toolbar icon shows a red **!** badge and the popup
  opens with the failing input and the error.

It reuses the app's own utility code directly (`src/core`, `src/types`,
`src/utilities/_generated/*`) — no utility is reimplemented here, and adding
or changing a utility in the main app is picked up automatically the next
time the extension is built.

## Build

From the repo root:

```bash
npm run build:extension
```

This runs `vite build --config packages/extension/vite.config.ts`, producing
`packages/extension/dist/`: the built `popup.html`/`options.html` with their
code-split scripts, `background.js` (the service worker), `manifest.json`
(the one source of the extension's version — releases bump it, see
[RELEASING.md](../../RELEASING.md); the build fails on a version the Chrome Web Store would
reject), and `icons/`. `--outDir` is honoured for all of it.

`vite build --mode development` also accepts messages from
`http://localhost` and `http://127.0.0.1` (any port), for trying "save to
extension" against `npm run dev`; a production build never does. An unpacked
build has its own id, so start the app with
`VITE_EXTENSION_IDS=<id from chrome://extensions> npm run dev`.

The service worker is built separately as **one self-contained file**
(~2 MB). MV3 service workers throw on dynamic `import()`, so the per-utility
lazy chunks the popup and options pages use can't be loaded there;
`inlineDynamicImports` folds every utility into `background.js` instead.
Utilities the extension refuses (below) are stripped from both builds.

## Load it in Chrome

1. `npm run build:extension`
2. Open `chrome://extensions`
3. Turn on **Developer mode** (top right)
4. **Load unpacked** → select `packages/extension/dist`

After changing source files, rebuild and click the extension's refresh icon
on `chrome://extensions` (service workers aren't hot-reloaded). A toolbar icon
that shows as a blank square means an old build is loaded: the placeholder
icons were replaced, so rebuild and reload it.

## How it decides what to offer

A utility is offered — in the context menu, the popup's utility list, and the
options page — only when its manifest `env` doesn't include `dom` (the
service worker has none), `main`, or `eval` (see `isEdgeSafe` in
`src/lib/registry.ts`). That excludes `custom_js`, `html_table_to_csv`,
`html_to_markdown` and `xml_to_json`.

## How a menu click works

1. `readSelection` is injected into the frame the menu was opened in and
   returns the exact selected text. The menu's own `selectionText` replaces
   line breaks with spaces (crbug.com/40740672), so it's only a fallback for
   pages that refuse injection (`chrome://`, the Web Store, PDF viewer).
   Password fields are never read.
2. The service worker runs the utility with its default params, or the saved
   pipeline with the params it was saved with. A pipeline run fails as a whole
   — the page is left untouched — when a step with the default error policy
   fails or a step set to `stop` halts it; a step whose author chose
   `passthrough` or `empty` is honoured.
3. `replaceSelectionOrCopy` is injected with the result and the text that was
   transformed. It writes only if the field's selection still equals that
   text — otherwise (non-editable text, or the selection moved) it copies.
   A cross-origin iframe the extension may not script gets the copy via the
   top frame.

## Favourites, saved pipelines and the web app

- **Favourites** are the utilities on the menu ("Apply: …"), in order; they
  are the `menuUtilities` list in `chrome.storage.sync`, so browser sync
  carries them between devices.
- **Saved pipelines** ("Pipeline: …") live in `chrome.storage.local` as
  `pipelines` — not `sync`, whose 8 KB-per-item quota one pipeline with a
  lookup table or a long regex can exceed. Up to 50, each at most 100 000
  JSON characters, every step one the extension can run (checked again when
  stored and when run). Saving under an existing name (ignoring case)
  replaces that pipeline in place.
- **Save to extension.** The manifest's `externally_connectable` lists the
  app's own origins (`BRIDGE_ORIGINS` in `src/core/extensionBridge.ts`; the
  build fails if they drift), so pages there can call
  `chrome.runtime.sendMessage(STORE_EXTENSION_ID, …)`. The app pings the
  extension and shows **save to extension** only when it answers. Unlike a
  content script, this adds no install-time permission warning — a new one
  would disable the published extension for every user until they approved
  it. The service worker (`onMessageExternal`) answers only the top frame of
  those origins, re-sanitizes the steps (`sanitizeSteps`) and refuses any it
  can't run. A self-hosted app (a custom base URL) can't message it: add
  pipelines from its share links on the options page instead.

## Layout

- `manifest.json` — MV3 manifest template.
- `src/background.ts` — the context-menu tree (rebuilt on install, on browser
  startup, and whenever the favourites or saved pipelines change; rebuilds are
  serialized), click handling, and messages from the web app.
- `src/lib/library.ts` — saving pipelines and merging favourites (shared by
  the options page and the bridge handler), with read-modify-write of the
  stored lists serialized.
- `src/lib/registry.ts` — which utilities may run here, running one with its
  defaults filled in (the app's `runPipeline`) or a saved pipeline, and `resultToText` (JSON
  pretty-printed, bytes decoded as UTF-8 or listed when they aren't text).
- `src/lib/menu.ts` — pure computation of the menu-item tree (a literal `%s`
  in a pipeline name is broken so Chrome doesn't substitute the selection).
- `src/lib/replace.ts` — the two functions injected into the page. Chrome
  serializes them with `Function.prototype.toString`, so each must stay fully
  self-contained; the tests run them from their source text for that reason.
- `src/lib/storage.ts` — `chrome.storage` wrappers (favourites and base URL
  in `sync`; saved pipelines and `lastResult`/`lastError` for the popup in
  `local`, pipelines re-validated on read) and base URL validation.
- `src/lib/paramControls.ts` — string/number/boolean/select param inputs for
  the popup; any other param kind runs with its default.
- `src/popup.ts` / `popup.html` — toolbar popup: pick a utility (favourites
  and saved pipelines first), run it on a text box, copy the output, or jump
  to the full app.
- `src/options.ts` / `options.html` — favourites (ordered list plus a
  searchable checklist), the app's base URL, reset to defaults, and saved
  pipelines (rename, reorder, open in the app, delete, add from a share link).
- `vite.config.ts` — popup/options build, plus a plugin that builds the
  service worker, checks `externally_connectable`, and copies `manifest.json` and `icons/`.
- `icons/` — 16/32/48/128 px PNGs (32 px for the toolbar on high-DPI screens),
  generated by `store-listing/generate.mjs` from the app icon.

## Options

- **App base URL** — where "Open selection in String Utility Belt" opens
  (`${baseUrl}/?text=<selection>`, read by the app's share-target handler);
  defaults to `https://stringutilitybelt.com`. Must be an absolute http(s)
  URL; any query or hash is dropped.
- **Favourites** — the menu's utilities, reorderable, chosen from a checklist
  (search by name, id, alias, tag or category); defaults to `base64_decode`,
  `base64_encode`, `url_decode`, `url_encode`, `jwt_decode`, `json_pretty`,
  `case`, `trim`, `unescape_html`, `sha3`. Favourites and the base URL are
  saved with **Save**; with none, only saved pipelines and "Open selection…"
  are on the menu.
- **Saved pipelines** — changes apply immediately; the list follows pipelines
  saved from the web app while the page is open. "Open in app" opens the
  pipeline as a share link (`#/p/…`) at the base URL, for editing; save it
  back under the same name to update it.

## Tests

```bash
npx vitest run packages/extension --maxWorkers=2
```

`tests/icons.test.ts` decodes each icon and checks it shows the mark (not a
blank or solid square). `tests/dist-manifest.test.ts` checks the built `dist/`
(manifest references, the origins that may message it, no content scripts or
host permissions, no inline scripts, a self-contained service worker) and evaluates
`background.js` in plain Node — no DOM, like a service worker — driving real
menu clicks against a jsdom page. It skips until `dist/` exists, so build
first.
