---
title: CSS Color Converter: Hex, RGB, HSL, OKLCH Online
description: Convert a CSS color online between hex, rgb(), hsl(), hwb(), lab(), lch(), oklab(), oklch() and named colors, or get every notation as JSON.
---
## What does this color converter do?

CSS recognizes a color written a dozen different ways (a hex triplet, `rgb()`, `hsl()`, a named color
like `rebeccapurple`, or one of the newer perceptual spaces like `oklch()`), and real stylesheets and
design tools disagree about which one they hand you. This tool parses any of those notations and
re-renders the color in whichever one you need, or produces every notation at once as JSON when you
want the full picture.

## How it works

Set **to** to the notation you want. Input is parsed regardless of which notation it arrives in, so
converting a named color to HSL, for instance, needs no intermediate step:

```example
title: a named color to hsl
input: red
params: {"to": "hsl", "perLine": true, "precision": 2}
output: hsl(0, 100%, 50%)
```

Setting **to** to `all` returns every supported notation for the color as one JSON object, along with
its nearest or exact named-color match and its 0–255 RGB components. That is useful for seeing a color's
full profile at once, or for picking a value out of the result programmatically:

```example
title: hex to every notation at once
input: #336699
params: {"to": "all", "perLine": true, "precision": 2}
output:
{
  "input": "#336699",
  "hex": "#336699",
  "hexAlpha": "#336699ff",
  "rgb": "rgb(51, 102, 153)",
  "rgba": "rgba(51, 102, 153, 1)",
  "hsl": "hsl(210, 50%, 40%)",
  "hsla": "hsla(210, 50%, 40%, 1)",
  "hwb": "hwb(210 20% 40%)",
  "lab": "lab(41.52 -4.57 -33.49)",
  "lch": "lch(41.52 33.8 262.23)",
  "oklab": "oklab(0.5 -0.03 -0.09)",
  "oklch": "oklch(0.5 0.1 250.43)",
  "named": "steelblue",
  "namedExact": false,
  "alpha": 1,
  "components": {
    "r": 51,
    "g": 102,
    "b": 153
  }
}
```

`named` reports the closest CSS named color even when the input is not one exactly. Here `#336699`
is not itself a named color, so it reports the nearest match (`steelblue`) and sets `namedExact` to
`false`; an exact match, like converting `#663399` itself, sets `namedExact` to `true` and names it
`rebeccapurple`. The **lab**, **lch**, **oklab**, and **oklch** outputs use the newer, perceptually
more uniform color spaces from CSS Color 4, which help when you need to reason about how different two
colors will actually look, not just how their RGB numbers compare.

**precision** sets the maximum number of decimal places in the `hsl`, `hwb`, `lab`, `lch`, `oklab` and
`oklch` components (trailing zeros are dropped, which is why `33.8` above shows one); `rgb` channels
are always whole numbers from 0 to 255, and alpha always gets at least two places:

```example
title: precision controls the number of decimal places
input: #4a90d9
params: {"to": "oklch", "precision": 3}
output: oklch(0.641 0.131 251.419)
```

## Options

- **to**: the output notation: `hex`, `hex-alpha`, `rgb`, `rgba`, `hsl`, `hsla`, `hwb`, `lab`, `lch`,
  `oklab`, `oklch`, `named`, or `all` (every notation as JSON). Default `hex`.
- **per line**: on by default; converts each line of input as a separate color.
- **precision**: 0–10, default 2: the most decimal places shown in non-integer components.

## Common uses

- Converting a design tool's color value into whatever notation a stylesheet or codebase expects.
- Looking up a color's HSL or OKLCH representation to adjust its lightness or saturation directly.
- Finding the nearest named CSS color for an arbitrary hex value.
- Converting a whole palette at once, one color per line, into a consistent notation.

## Tips and pitfalls

Alpha is kept by `hex-alpha` (an 8-digit hex value), `rgba`, `hsla`, and (as a `/ alpha` suffix
whenever the color is not fully opaque) `hwb`, `lab`, `lch`, `oklab` and `oklch`. Plain `hex`, `rgb`
and `hsl` deliberately drop it, so pick one of the alpha-carrying notations when the alpha channel
needs to survive the conversion.
`lab()`, `lch()`, `oklab()`, and `oklch()` can describe colors outside what a normal display can
actually show (out-of-gamut colors); converting one of those back to `hex` or `rgb` clamps each
channel to the visible range, so a round trip through those spaces is not always lossless if the
original value was already out of gamut. An unparseable color (including plain words that are not CSS
color names, like a stray "café" in a batch of lines) raises a clear "invalid color" error rather
than silently substituting black or skipping the line. To measure whether two colors have enough
contrast for accessible text rather than just converting between notations, see
[color contrast](/util/color_contrast/).
