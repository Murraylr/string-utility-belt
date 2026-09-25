---
title: ASCII Banner Generator — Big Text Art Online
description: Turn text into large ASCII art banners online, like the classic figlet tool. Choose a block, banner, small, or slant font and adjust letter spacing.
---
## What is an ASCII banner?

An ASCII banner renders ordinary text as large letters built out of characters, the way the classic Unix `figlet` command does. It is useful for splash screens in a terminal app, eye-catching headers in a README or log file, or just a novelty way to print a name or message. This tool draws every printable ASCII character — letters, digits and punctuation — from a built-in 5×7 pixel bitmap font — there is no external font file or figlet dependency involved.

## How it works

Each character is looked up in the bitmap font, which defines it as 7 rows of 5 cells, and rendered using one of four styles:

- **block** — each pixel becomes a 2-column-wide solid block character, giving a bold, chunky look.
- **banner** — each pixel becomes a single `#` character, closer to a classic typewriter-art banner.
- **small** — two bitmap rows are squeezed into a single line of text using half-block characters (`▀`, `▄`, `█`), so the whole glyph is about half as tall.
- **slant** — the same shape as `block`, with each row shifted one column further right than the row below it, giving an italic lean.

Characters are looked up case-insensitively, so lowercase and uppercase input render identically. A character the font has no glyph for (anything outside printable ASCII, including accented letters) falls back to a hollow rectangular "tofu" box rather than being dropped silently. Tabs render as spaces.

```example
title: banner font with one column of spacing
params: {"font": "banner", "spacing": 1}
input: HI
output: #   #  ###
#   #   #
#   #   #
#####   #
#   #   #
#   #   #
#   #  ###
```

The **block** font doubles each pixel's width, producing a bolder, wider result from the same bitmap:

```example
title: block font, doubled pixel width
params: {"font": "block"}
input: I
output:   ██████
    ██
    ██
    ██
    ██
    ██
  ██████
```

The **small** font halves the height by packing two bitmap rows into each text row, using half-block shading where only the top or bottom half of a cell is lit:

```example
title: small font packs two bitmap rows per line
params: {"font": "small"}
input: a
output: ▄▀▀▀▄
█▄▄▄█
█   █
▀   ▀
```

Empty input produces no output at all, for any font:

```example
title: empty input produces nothing
params: {"font": "slant"}
input:
output:
```

## Options

- **font** (`font`, default `block`) — one of `block`, `banner`, `small`, or `slant`, as described above.
- **letter spacing** (`spacing`, default `1`) — the number of extra blank columns inserted between letters, from 0 to 64. A stray very large number is rejected rather than allocated, since the pipeline re-renders on every keystroke.

Multi-line input is rendered as one banner per line, stacked directly on top of each other; a blank input line stays a single blank line, so an empty line between words separates their banners.

## Common uses

- Splash text or headers printed by a CLI tool on startup.
- Section separators in log files or generated documentation.
- README banners, ASCII art signatures, and other novelty text art.

## Tips and pitfalls

- Only printable ASCII characters render as proper glyphs; anything else, including accented letters, CJK text and emoji, renders as a hollow placeholder box (one per code point).
- Longer input produces proportionally wider output — a banner is meant for short words or a handful of characters, not paragraphs.
- Combine with [box text](/util/box_text/) to frame a banner in a border.
- If you need reversible or readable-at-a-glance text transforms rather than large art, [alternating case](/util/alternating_case/) or [swap case](/util/swap_case/) are lighter-weight options.
