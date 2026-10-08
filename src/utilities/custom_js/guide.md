---
title: Custom JavaScript Step: Run Your Own Code in a Sandbox
description: Add a JavaScript step to your pipeline and run your own function body on the value, executed in an isolated browser sandbox with no network access.
---
## What is the custom JavaScript step?

Every built-in utility does one specific job. The custom JavaScript step is the escape hatch for everything else: you write the body of a function, and it runs on whatever value the previous step produced: a string, raw bytes, or parsed JSON. It exists for the one-off transform that doesn't have (or doesn't need) its own dedicated utility: reordering CSV columns with custom logic, computing a derived value, or gluing together two other transforms with a line of code.

A freshly added step ships with its **code** field containing only comments, so it changes nothing until you actually write something:

```example
title: a new step is a no-op until you write code
params: {"code": "// return String(input).toUpperCase()"}
input: passes straight through
output: passes straight through
```

An empty code field behaves the same way:

```example
title: empty code also passes the value straight through
params: {"code": ""}
input: hello
output: hello
```

## How it works

Inside the function body, `input` holds the value from the previous step, and the body must `return` the result. `return String(input).toUpperCase()` uppercases text, `return JSON.parse(input)` turns a JSON string into a real object, and `await` works for asynchronous code. Whatever you return becomes the value the next step receives, so a step can change the value's type entirely: turn a string into JSON, or bytes into a string.

Only certain shapes are accepted back: a string, a `Uint8Array` (for bytes), or plain JSON made of objects, arrays, strings, finite numbers, booleans, and `null`. Returning a bare number, boolean, or `null` directly (`return 42`) is rejected. Wrap it in a string (`return String(42)`) or in a JSON structure (`return { value: 42 }`) instead. Functions, `Date` objects, class instances, and circular references are rejected too, since they cannot be carried safely to the next step or shown in a preview.

## Running in a sandbox

Your code does not run in the page you're looking at. Each run gets a freshly created, isolated frame with an opaque origin (it has no cookies, no `localStorage`, and no way to reach the rest of the app or its data), which in turn starts a separate Worker to actually execute your function. A strict Content Security Policy on that frame, which the Worker inherits, blocks `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, and loading scripts from any URL, so your code has no ordinary way to send your input anywhere; if the browser turns out not to enforce that policy inside the Worker, the step refuses to run. The frame and its Worker are torn down after the run, and a run that takes longer than its **timeout** is stopped.

Because the step runs arbitrary code, custom JavaScript steps that arrive from a shared link, an embed, or an imported file start out **disabled** until you review and re-enable them. It is the same way a spreadsheet or document viewer warns before running an embedded macro.

## Options

- **code**: the body of the function that runs on the input. Leaving it blank, or leaving in only comments, passes the value through unchanged.
- **timeout (ms)**: how long a run is allowed before it is stopped, a whole number from 100 to 30,000 milliseconds (2,000 by default). A value outside that range is rejected as a step error.

## Common uses

- A quick data transform that no existing utility covers: custom parsing, a bespoke checksum, reshaping a JSON structure.
- Chaining logic that would otherwise need several steps, when a few lines of code are simpler than composing utilities.
- Prototyping a transform before it becomes a dedicated utility.
- Inspecting or reshaping the JSON output of an earlier step (an API response, a config file) with plain object and array code.

## Tips and pitfalls

- The browser sandbox described above exists only in the web app. The HTTP API, the MCP server, and the browser and editor extensions cannot run this step: it fails with an error rather than being silently skipped. The `subelt` CLI runs it only when you pass `--allow-custom-js`, and there the code runs in a Node `vm` context on a worker thread, which is **not** a security boundary. Use that flag only on pipelines you trust.
- The browser sandbox blocks network access and access to the rest of the app by design, so it is not a general-purpose scripting environment: it cannot read cookies, local files, or other tabs.
- An uncaught error inside your code (a thrown exception, a reference to an undefined variable) surfaces as that step's error in the pipeline, the same way a built-in utility's validation error does, so the rest of the pipeline can still be edited and rerun.
- If you only need find-and-replace rules, [multi_replace](/util/multi_replace/) is simpler, and [regex_extract](/util/regex_extract/) pulls out every match of a pattern; neither requires writing JavaScript.
