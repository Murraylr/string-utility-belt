---
title: QR Code Generator Online: SVG, ASCII & JSON
description: Turn text or a URL into a QR code online as an inline SVG, ASCII art or a JSON module matrix, with adjustable error correction and colors.
---
## What is a QR code?

A QR (Quick Response) code is a two-dimensional barcode that encodes text (a URL, a snippet of contact info, a Wi-Fi password) as a grid of black and white square modules that a camera can scan and decode. This tool builds that grid from your input and renders it three ways: as a self-contained inline SVG (ready to drop into a web page), as ASCII art (for a quick look in a terminal or a text file), or as a raw JSON module matrix (for feeding into your own renderer).

## How it works

The input text is encoded into a grid of modules, whose size depends on how much data it holds and how much error-correction redundancy you asked for. The `json` output exposes that grid directly, including the finder-pattern squares in three of the four corners that let a scanner locate and orient the code:

```example
title: json module matrix for a short string
input: HI
params: {"errorCorrection": "L", "output": "json"}
output: {
  "text": "HI",
  "version": 1,
  "errorCorrection": "L",
  "moduleCount": 21,
  "moduleSize": 4,
  "margin": 4,
  "dark": "#000000",
  "light": "#ffffff",
  "rows": [
    "111111100100101111111",
    "100000101001001000001",
    "101110100100001011101",
    "101110101001001011101",
    "101110100011101011101",
    "100000101110101000001",
    "111111101010101111111",
    "000000000011100000000",
    "111110111100110101010",
    "011101001110100100000",
    "000001110001010011110",
    "001100010010000110100",
    "100001110001010010101",
    "000000001011111001000",
    "111111101000101100010",
    "100000100101111001001",
    "101110101010100100100",
    "101110101110100100100",
    "101110101001010011100",
    "100000101000000110100",
    "111111101111010011110"
  ]
}
```

Each row is a string of `1`s (dark) and `0`s (light), left to right. It is the same 21×21 grid the `svg` and `ascii` outputs draw from. Rendered as ASCII art with a smaller module size and no margin, the same grid for the same input looks like this:

```example
title: ascii art of the same code (smaller modules, no margin)
input: HI
params: {"errorCorrection": "L", "output": "ascii", "moduleSize": 2, "margin": 0}
output: ███████  █  █ ███████
█     █ █  █  █     █
█ ███ █  █    █ ███ █
█ ███ █ █  █  █ ███ █
█ ███ █   ███ █ ███ █
█     █ ███ █ █     █
███████ █ █ █ ███████
          ███        
█████ ████  ██ █ █ █ 
 ███ █  ███ █  █     
     ███   █ █  ████ 
  ██   █  █    ██ █  
█    ███   █ █  █ █ █
        █ █████  █   
███████ █   █ ██   █ 
█     █  █ ████  █  █
█ ███ █ █ █ █  █  █  
█ ███ █ ███ █  █  █  
█ ███ █ █  █ █  ███  
█     █ █      ██ █  
███████ ████ █  ████ 
```

Empty input produces empty output in every format, rather than a blank or invalid code:

```example
title: empty input
input:
output:
```

## Options

- **error correction**: `L` (~7% of the code can be damaged and still scan), `M` (~15%, the default), `Q` (~25%), or `H` (~30%). Higher levels tolerate more dirt, damage, or a logo overlaid in the middle, at the cost of needing a larger grid to hold the same data.
- **module size (px)**: the pixel size of one square module in the `svg` output; default `4`, from 1 to 128. It also scales how wide each module renders in `ascii` output (rounded to whole terminal characters).
- **margin (modules)**: the quiet zone around the code, in module widths; default `4`, from 0 to 64. Scanners rely on this blank border to distinguish the code from its surroundings, so shrinking it below the standard 4 modules can make a real-world code harder to scan even though the grid itself is unchanged.
- **dark colour / light colour**: the two module colors for `svg` output; default black on white. Setting light to `transparent` or `none` omits the background rectangle entirely, letting the code sit on whatever background it is placed over. Colors are validated to reject quote, angle-bracket and `&` characters, since they are written directly into the SVG markup. The `ascii` output ignores both colors.
- **output**: `svg` (default, a single self-contained `<svg>` element with no external references), `ascii`, or `json`.

## Common uses

- Generating a scannable link to a page, a Wi-Fi network, or a contact card for print or a web page.
- Embedding a QR code directly in HTML or a PDF as inline SVG, with no separate image file to host.
- Building a custom QR renderer (a native app, a canvas element, a printer driver) from the raw `json` module matrix.

## Tips and pitfalls

- Input is always encoded in the QR byte mode, even when it is all digits or uppercase letters that the more compact numeric or alphanumeric modes could hold. So the grid size (and therefore the `version` number reported in `json` output) is driven by how many UTF-8 bytes your input encodes, not how many characters it has. Accented letters and especially emoji take multiple bytes each and can push a short-looking string into a larger grid than plain ASCII of the same character count.
- If the input is too long for even the largest QR version at the chosen error-correction level, this tool reports a clear error asking you to shorten the input or lower the error-correction level, rather than producing a truncated or corrupted code.
- A very large error-correction level is only worth the larger grid it produces if the code will actually be damaged, dirty, or partially covered (for example, by a logo) after being generated. For a code that will only ever be read digitally, the default `M` level is usually sufficient.
- To encode the QR payload text itself (a URL with query parameters, for instance), see [url encode](/util/url_encode/) or [url build](/util/url_build/) before feeding the result in here.
