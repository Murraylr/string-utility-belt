---
title: Line Ending Converter — LF, CRLF & CR Online (dos2unix)
description: Convert line endings between LF, CRLF, and CR online, or detect which a file uses. A browser dos2unix / unix2dos with control over the final newline.
---
## What are LF, CRLF, and CR line endings?

Different operating systems historically ended lines differently: Unix and macOS use a single line feed (`LF`, `\n`), classic Mac OS used a lone carriage return (`CR`, `\r`), and Windows uses both together (`CRLF`, `\r\n`). Text that mixes these — often the result of editing the same file on different platforms, or a bad copy-paste — can confuse diff tools, version control, and line-based parsers. This tool converts every line ending in a text to one consistent flavor (`lf`, `crlf`, or `cr`), or, with `mode: detect`, reports which flavors are present without changing anything.

## How it works

Every `\r\n` pair, lone `\n`, and lone `\r` in the input is recognized as one line break — a `\r\n` pair is never miscounted as two separate breaks — and, in convert mode, rewritten to the target ending you chose. Mixed input converts cleanly to a single consistent ending:

```example
title: normalizing mixed endings to LF (the default)
input-encoding: hex
input: 61 0d 0a 62 0d 63 0a 64
output: a
b
c
d
```

Converting to `crlf` or `cr` works the same way, just rewriting to a different target ending instead of `\n`.

### Detecting line endings

Setting `mode` to `detect` does not rewrite anything — it counts each flavor and reports the result as structured data instead of text, along with whether the file is `mixed` and which ending is `dominant` (ties resolve in the order CRLF, then LF, then CR):

```example
title: detecting a mix of all three endings
params: {"mode": "detect"}
input-encoding: hex
input: 61 0d 0a 62 0a 63 0d 64
output: {
  "crlf": 1,
  "lf": 1,
  "cr": 1,
  "mixed": true,
  "dominant": "crlf"
}
```

### Controlling the final newline

Independently of which ending is used, `finalNewline` decides what happens at the very end of the text — `add` appends one if it is missing:

```example
title: adding a trailing newline if one is missing
params: {"finalNewline": "add"}
input: a
b
output:
a
b

```

`remove` strips a trailing run of line breaks entirely, however many there are:

```example
title: removing one or more trailing blank lines
params: {"finalNewline": "remove"}
input:
a
b


output: a
b
```

Plain conversion modes return empty output for empty input:

```example
title: empty input under a conversion mode
input:
output:
```

## Options

- **mode** (`mode`, default `lf`) — `lf`, `crlf`, or `cr` to convert every line ending to that flavor; `detect` to instead report counts without changing the text.
- **final newline** (`finalNewline`, default `keep`) — `keep` leaves the presence or absence of a trailing line break as it was; `add` appends one (in the target ending) if the text does not already end with one, though empty input stays empty; `remove` strips any trailing run of line breaks entirely. Ignored by `detect`.

## Common uses

- Converting a file saved on Windows to Unix line endings before committing it, or the reverse — the classic `dos2unix` / `unix2dos` job.
- Cleaning up a text file assembled from pieces copied from different sources with inconsistent endings.
- Checking which line ending a suspicious file actually uses before deciding how to process it further.
- Enforcing a single trailing newline convention across generated files.

## Tips and pitfalls

- `detect` output is JSON, not text — pipe it into another JSON-handling utility, or read it directly, rather than expecting a converted copy of your input.
- A single line of text with no line breaks at all reports every count as `0` and `dominant` as `none` under `detect`, rather than an error.
- `finalNewline: remove` strips every trailing line break, however many there are, collapsing several blank lines at the end of a file down to none.
- Line endings inside your data are the only thing this tool changes; if you also need to reformat tabs and spaces, trim trailing whitespace per line, or drop blank lines, see [tabs ↔ spaces](/util/tabs_spaces/), [trim lines](/util/trim_lines/) or [remove blank lines](/util/remove_blank_lines/).
