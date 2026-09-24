# String Utility Belt — browser extension

A Manifest V3 extension that runs String Utility Belt transformations on
selected text without opening the app: right-click a selection (or a text
field you're editing) → **String Utility Belt** → pick a utility.

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
(`version` stamped from the root `package.json`), and `icons/`. `--outDir`
is honoured for all of it.

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
on `chrome://extensions` (service workers aren't hot-reloaded).

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
2. The service worker runs the utility with its default params.
3. `replaceSelectionOrCopy` is injected with the result and the text that was
   transformed. It writes only if the field's selection still equals that
   text — otherwise (non-editable text, or the selection moved) it copies.
   A cross-origin iframe the extension may not script gets the copy via the
   top frame.

## Layout

- `manifest.json` — MV3 manifest template.
- `src/background.ts` — the context-menu tree (rebuilt on install, on browser
  startup, and whenever `chrome.storage.sync`'s `menuUtilities` changes;
  rebuilds are serialized) and click handling.
- `src/lib/registry.ts` — which utilities may run here, running one with its
  defaults filled in (the app's `runPipeline`), and `resultToText` (JSON
  pretty-printed, bytes decoded as UTF-8 or listed when they aren't text).
- `src/lib/menu.ts` — pure computation of the menu-item tree.
- `src/lib/replace.ts` — the two functions injected into the page. Chrome
  serializes them with `Function.prototype.toString`, so each must stay fully
  self-contained; the tests run them from their source text for that reason.
- `src/lib/storage.ts` — `chrome.storage` wrappers (menu utilities and base
  URL in `sync`; `lastResult`/`lastError` for the popup in `local`) and base
  URL validation.
- `src/lib/paramControls.ts` — string/number/boolean/select param inputs for
  the popup; any other param kind runs with its default.
- `src/popup.ts` / `popup.html` — toolbar popup: pick a utility, run it on a
  text box, copy the output, or jump to the full app.
- `src/options.ts` / `options.html` — searchable checklist of context-menu
  utilities, the app's base URL, and reset to defaults.
- `vite.config.ts` — popup/options build, plus a plugin that builds the
  service worker and copies `manifest.json` and `icons/`.
- `icons/` — 16/48/128 px PNGs.

## Options

- **App base URL** — where "Open selection in String Utility Belt" opens
  (`${baseUrl}/?text=<selection>`, read by the app's share-target handler);
  defaults to `https://stringutilitybelt.com`. Must be an absolute http(s)
  URL; any query or hash is dropped.
- **Context menu utilities** — a checklist (search by name, id, alias, tag or
  category); defaults to `base64_decode`, `base64_encode`, `url_decode`,
  `url_encode`, `jwt_decode`, `json_pretty`, `case`, `trim`,
  `unescape_html`, `sha3`. Saving with nothing checked leaves only
  "Open selection…" on the menu.

## Tests

```bash
npx vitest run packages/extension --minWorkers=1 --maxWorkers=2
```

`tests/dist-manifest.test.ts` checks the built `dist/` (manifest references,
no inline scripts, a self-contained service worker) and evaluates
`background.js` in plain Node — no DOM, like a service worker — driving real
menu clicks against a jsdom page. It skips until `dist/` exists, so build
first.
