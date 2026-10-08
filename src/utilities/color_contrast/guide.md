---
title: WCAG Contrast Checker: Text Color Ratio Online
description: Check the WCAG 2.1 contrast ratio between two colors online, with AA/AAA pass or fail for normal text, large text, and UI components.
---
## What is WCAG contrast?

The Web Content Accessibility Guidelines define a contrast ratio between a foreground and background
color, from 1:1 (identical colors, no contrast at all) to 21:1 (pure black on pure white, the
maximum). Low-vision and color-blind users rely on sufficient contrast to read text at all, which is
why WCAG 2.1 sets minimum ratios for different content types. At level AA that is 4.5:1 for normal
body text and a more relaxed 3:1 for large text (success criterion 1.4.3) and for UI components and
graphics (1.4.11). The stricter AAA tier (1.4.6) raises the text minimums to 7:1 for normal and 4.5:1
for large text; it sets nothing stricter for UI components, so this tool reports 3:1 for them at both
levels. It computes the exact ratio between two colors and reports which of those thresholds it clears.

## How it works

Set **foreground** and **background**, or leave **foreground** blank and let the tool pull colors
directly from the input text. That is handy for checking a pair you already have written down somewhere
else:

```example
title: a pair that looks like it passes, but does not quite
input:
params: {"foreground": "#0078d7", "background": "#ffffff"}
output:
{
  "foreground": "#0078d7",
  "background": "#ffffff",
  "foregroundInput": "#0078d7",
  "backgroundInput": "#ffffff",
  "composited": false,
  "ratio": 4.5,
  "foregroundLuminance": 0.1834,
  "backgroundLuminance": 1,
  "AA": {
    "normalText": false,
    "largeText": true,
    "ui": true
  },
  "AAA": {
    "normalText": false,
    "largeText": false,
    "ui": true
  },
  "thresholds": {
    "AA": {
      "normalText": 4.5,
      "largeText": 3,
      "ui": 3
    },
    "AAA": {
      "normalText": 7,
      "largeText": 4.5,
      "ui": 3
    }
  },
  "summary": "4.5:1 — passes AA for large text and UI only"
}
```

That example is the whole reason the tool grades the *exact* ratio, not the rounded one shown to the
user: `#0078d7` on white computes to 4.4989:1, which rounds to "4.5" and looks like it clears the
4.5:1 AA minimum for normal text. But the unrounded value is fractionally under it, so `AA.normalText`
correctly reports `false` even though the displayed `ratio` reads exactly `4.5`.

If **foreground** is left blank, the tool scans the input text for anything that parses as a CSS
color (hex, a named color, `rgb()`, and so on) and uses the first one it finds as the foreground and
the second (if any) as the background, falling back to the **background** parameter otherwise:

```example
title: reading both colors straight from the input text
input: #000000 on #ffffff
output:
{
  "foreground": "#000000",
  "background": "#ffffff",
  "foregroundInput": "#000000",
  "backgroundInput": "#ffffff",
  "composited": false,
  "ratio": 21,
  "foregroundLuminance": 0,
  "backgroundLuminance": 1,
  "AA": {
    "normalText": true,
    "largeText": true,
    "ui": true
  },
  "AAA": {
    "normalText": true,
    "largeText": true,
    "ui": true
  },
  "thresholds": {
    "AA": {
      "normalText": 4.5,
      "largeText": 3,
      "ui": 3
    },
    "AAA": {
      "normalText": 7,
      "largeText": 4.5,
      "ui": 3
    }
  },
  "summary": "21:1 — passes AAA for normal and large text"
}
```

A translucent color is composited onto its background before the ratio is measured (first the
background over white, then the foreground over the result), since contrast is only defined between
two fully opaque colors, and `composited` in the output reports whether that flattening happened.

## Options

- **foreground**: a CSS color (hex, named, `rgb()`, `hsl()`, `lab()`, `oklch()`, and more). Left
  blank, the tool reads the first color it finds in the input instead.
- **background**: a CSS color, default `#ffffff`. Used whenever **foreground** is set (the input is
  then ignored), or when the input supplies only one color.

## Common uses

- Checking a text/background color pairing from a design system against WCAG 2.1 AA before shipping
  it.
- Checking a pair copied straight out of CSS (`color: #333; background: #fafafa`) without retyping
  it. Only the first two colors found are used, so check a palette one pair at a time.
- Verifying that translucent text or overlays still meet contrast requirements once composited onto
  their actual background.
- Double-checking a ratio that a design tool rounds for display, since the exact value can fall just
  short of a threshold that the rounded number appears to clear.

## Tips and pitfalls

This tool checks contrast only. It says nothing about color choice for color-blind users beyond
luminance, font size, or any of WCAG's other text-legibility criteria, so a passing ratio here is
necessary but not sufficient for full accessibility compliance. "Large text" in WCAG terms means at
least 18pt regular weight or 14pt bold, which is why it gets a more relaxed 3:1 threshold than normal
body copy. When nothing in the input text parses as a color and **foreground** is empty, the tool
raises a clear error rather than guessing; when the input is entirely empty and no foreground is set,
it returns an empty result instead, on the basis that there is simply nothing to measure yet. For
converting between color notations rather than checking contrast, see
[color convert](/util/color_convert/).
