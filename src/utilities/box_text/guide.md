---
title: ASCII Box Text Generator — Draw Borders Around Text
description: Draw a border around text online in single, double, round, bold, ascii, or dashed box-drawing characters, with padding, alignment, a title, and word wrapping.
---
## What is a text box?

A text box wraps a border of characters around a block of text, the way a comment banner in source code, a terminal alert, or a plain-text README section header often does. This tool draws that border using Unicode box-drawing characters (or plain ASCII `+-|` if you need maximum compatibility), and handles multi-line input, padding, alignment, an optional title in the top border, and wrapping long lines to a fixed width.

## How it works

Every line of input is measured in display columns — wide CJK characters and most pictographic emoji count as two columns, combining marks and zero-width characters as zero — so the border lines up even with mixed-width text. The box is built from four pieces: the top border (with an optional title), the padded and aligned content lines, blank padding lines when vertical padding is requested, and the bottom border.

```example
title: default single-line border
input: Hi
output: ┌────┐
│ Hi │
└────┘
```

A **title** is drawn inset into the top border, and a `style` other than the default `single` swaps in a different set of border characters:

```example
title: double border with a title
params: {"style": "double", "title": "Note"}
input: Hello
output: ╔═ Note ═╗
║ Hello  ║
╚════════╝
```

### Fixed width and wrapping

When `width` is left at `0` (the default), the box fits itself to the widest line of content, or widens further so the whole title fits. Setting a fixed `width` instead wraps long lines at word boundaries — breaking a single over-long word only if it has no choice — and aligns every line inside that width:

```example
title: fixed width centers text inside it
params: {"width": 18, "align": "center"}
input: the quick fox
output: ┌────────────────┐
│ the quick fox  │
└────────────────┘
```

```example
title: ascii-only style for plain-text output
params: {"style": "ascii", "padding": 0}
input: hi
output: +--+
|hi|
+--+
```

Empty input produces no box at all:

```example
title: empty input produces no box
input:
output:
```

## Options

- **style** (`style`, default `single`) — the border character set: `single`, `double`, `round`, `bold`, `ascii` (plain `+`, `-`, `|`), or `dashed`.
- **padding** (`padding`, default `1`, 0–500) — the number of space columns between each side border and the text. Values above 1 also add `padding − 1` blank lines above and below the text, so the default box has no blank rows.
- **align** (`align`, default `left`) — how each line is positioned inside the box: `left`, `center`, or `right`.
- **title** (`title`, default none) — text drawn into the top border. Line breaks inside it are flattened to spaces so they cannot tear the border apart, and with a fixed `width` it is truncated if there is not room for all of it.
- **width** (`width`, default `0`, meaning fit to content, up to 10,000) — a fixed total box width. Text is word-wrapped to fit inside it; if the width is too small even for the border and padding, the tool reports an error instead of drawing a broken box.

## Common uses

- Framing a warning, note, or summary in a plain-text file, commit message, or terminal output.
- Decorative headers for README files, changelogs, or CLI help text.
- Visually separating a block of generated ASCII art, such as an [ASCII banner](/util/ascii_banner/), from surrounding text.

## Tips and pitfalls

- Tabs in the input (and in the title) are expanded to spaces at 8-column tab stops before the border is measured, so a box around tab-indented text still lines up correctly.
- A title only appears if there is room for at least one of its characters after accounting for width and padding; otherwise the tool silently draws a plain, title-less border rather than failing.
- If you need to line up several rows of data into columns rather than framing a single block, use [align columns](/util/align_columns/) or [pad](/util/pad/) instead.
- For multi-line text that already exceeds your terminal width, set `width` explicitly rather than relying on the fit-to-content default, so long lines wrap instead of stretching the box.
