---
title: Pad String Online — Left Pad, Right Pad & Center Text
description: Pad text to a fixed width online. Add leading zeros, left-pad or right-pad with any character, or center a string — with worked examples.
---
## What does padding a string mean?

Padding adds filler characters to a string until it reaches a **target length**. It is how you turn `42` into `000042` for an invoice number, line up a column of names in a plain-text report, or make every record in a fixed-width file exactly the same size. This tool works like JavaScript's `padStart` / `padEnd`, and is close to Python's `rjust` / `ljust` / `center` (which accept only a single pad character and split odd padding differently), with the side chosen by a single option.

## How it works

The tool compares the length of your input with the **target length**:

1. If the input is already as long as the target (or longer), it is returned **unchanged** — padding never cuts text short. Use [truncate](/util/truncate/) if you also need a maximum length.
2. Otherwise it works out how many characters are missing and fills them with the **pad character**, on the side you chose.

The three sides:

| side | where the filler goes | also known as |
| --- | --- | --- |
| `end` (default) | after the text | right pad, `padEnd`, `ljust` |
| `start` | before the text | left pad, `padStart`, `rjust`, zero pad |
| `both` | split around the text | center |

### Zero-padding numbers

Padding at the start with `0` is the classic way to give numbers a fixed number of digits, so that they also sort correctly as text (`007` before `010`, where `7` would sort after `10`).

```example
title: zero-pad an order number to 6 digits
params: {"length": 6, "char": "0", "side": "start"}
input: 42
output: 000042
```

### Right-padding for aligned columns

Padding at the end fills short values out to the same width, so whatever follows them starts in the same column. The defaults — target length 10, a space, at the end — do exactly that with invisible trailing spaces; dots make it visible here.

```example
title: right-pad with dots to line up a column
params: {"length": 8, "char": ".", "side": "end"}
input: Total
output: Total...
```

### Centering

With `both`, the missing characters are split between the two sides. When the number is odd, the extra character always goes on the **right**, so the text sits half a position left of true center.

```example
title: center a heading with an odd amount of padding
params: {"length": 9, "char": "*", "side": "both"}
input: hi
output: ***hi****
```

### Multi-character pad strings

The pad character may be longer than one character. It is repeated as often as needed and then **cut off** at the target length, so the pattern may end part-way through.

```example
title: a repeating pattern, cut to fit
params: {"length": 7, "char": "ab", "side": "start"}
input: X
output: abababX
```

### Text that is already long enough

```example
title: longer input is left alone
params: {"length": 3, "char": "0", "side": "start"}
input: 12345
output: 12345
```

## Options

- **target length** — the length the result should have, from 0 to 1,000,000. It is a total, not the number of characters to add.
- **pad character** — the filler; one or more characters. Leaving it empty falls back to a space.
- **side** — `end`, `start` or `both`, as in the table above.

## Things to know

- Length is counted in JavaScript string units (UTF-16 code units), not visible characters. Most emoji and some rare CJK characters count as **2**, and an accented letter typed as a letter plus a combining accent also counts as 2, so such text may get less padding than you expect. Run [normalize](/util/normalize/) (NFC) first to merge combining accents.
- Tabs count as one character even though they display wider; convert them with [tabs spaces](/util/tabs_spaces/) before padding for display.
- The whole input is padded as one string, newlines included — it does not pad each line. To line up many rows of text, use [align columns](/util/align_columns/) instead.

## Common uses

- Fixed-width IDs, invoice numbers, dates and times (`7` → `07`).
- Plain-text tables, receipts and CLI output where columns must line up.
- Fixed-width file formats (COBOL, banking, EDI) where every field has an exact size.
- Binary and hex values with a fixed number of digits, for example after [number base convert](/util/number_base_convert/): `101` → `00000101`.
