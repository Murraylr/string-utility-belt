
# String Pipeline Workshop Pro

Production-grade React app for chaining string utilities, with per-step previews, local storage, colocated tests, MD5, and a custom function utility.

## Quickstart
```bash
npm i
npm run dev
```
open http://localhost:5173

## Using the app

These docs are also in the app itself: click **Docs** in the header, or go to `#/docs`.

String Utility Belt runs your text through a **pipeline**: an ordered list of steps. Each step applies one utility to the output of the step before it. The **result** panel shows the output of the last step.

### Build a pipeline
1. Type or paste text into the **input** box.
2. Add steps in either of these ways:
   - **Add utility** opens a browser of every utility. Filter it by category or search by name, then click a utility to add it.
   - The **quick add** dropdown adds a utility straight from the list.
3. New steps go to the end of the pipeline. The result updates as you type. You don't need to run anything.

### Work with steps
Each step card has these controls:

| Control | What it does |
|---|---|
| Checkbox (top left) | Turns the step on or off. A disabled step passes its input through unchanged. |
| ▲ / ▼ | Moves the step up or down. Order matters. |
| 🗑 | Removes the step. |
| **utility** dropdown | Swaps the step to a different utility. The step's parameters reset. |
| Parameter fields | Settings for the utility, such as case mode, regex pattern or max length. Each field starts at a sensible default. |

The badges next to the step number show the step's category and, when a preview is showing, the type of value it produced (`string`, `bytes` or `json`).

### Previews and errors
- Tick **show intermediate previews** to see each step's output below its card. This helps you find where a chain goes wrong.
- If a step fails, for example because of an invalid regex or bad hex, its card shows the error in red. The pipeline skips that step and keeps going with the previous value.

### Strings, bytes and JSON
Some utilities work on raw bytes instead of text (for example **Get bytes**, **hex decode** and **md5 hash**). The pipeline converts between types for you: text becomes UTF‑8 bytes when a step needs bytes, and the other way round. When the result is bytes, it's shown as decimal values, hex and, where possible, decoded UTF‑8 text.

### Get the result out
Under the result panel, **copy** puts the output on your clipboard and **download** saves it as `result.txt`.

### What's saved
Your steps, their settings and the preview toggle are saved in the browser's `localStorage`, so the pipeline is still there after you reload. The input text **is not** saved. To start over, delete the steps.

### Example: title to URL slug
Input: `  Crème Brûlée: A Guide!  `

| Step | Utility | Settings | Output |
|---|---|---|---|
| 1 | trim | — | `Crème Brûlée: A Guide!` |
| 2 | remove diacritics | — | `Creme Brulee: A Guide!` |
| 3 | slug | — | `creme-brulee-a-guide` |
| 4 | truncate | max length `12`, ellipsis cleared | `creme-brulee` |

### Available utilities
| Category | Utilities |
|---|---|
| String Ops | trim, slice, truncate, replace (plain text or regex with flags), normalize (NFC/NFD/NFKC/NFKD), remove diacritics |
| Formatting | change case (upper/lower/title/sentence), format case (camel/Pascal/snake/kebab and more), slug |
| Encoding | base64 encode, hex encode, Get bytes (utf8/hex/base64/unicode) |
| Decoding | base64 decode, hex decode |
| Hashing | hash (SHA‑256/SHA‑384), md5 hash |
| URL & JSON | url encode, url decode, json pretty |

## Tests
```bash
npm test
```

## Add a utility
Create `src/utilities/reverse/index.ts`:
```ts
import type { Utility } from '@/types/utility'
const util: Utility = {
  id: 'reverse',
  name: 'reverse',
  category: 'String Ops',
  description: 'Reverse the characters.',
  accepts: 'string',
  produces: 'string',
  params: {},
  apply: (input: any) => String(input).split('').reverse().join('')
}
export default util
```
Every `src/utilities/*/index.ts` is picked up automatically, so you don't need to register it anywhere else.
