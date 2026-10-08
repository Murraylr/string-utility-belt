---
title: Character Frequency Counter: Letter Count Online
description: Count how often each character appears in text online, with percentages, case folding, and table, JSON, or CSV output.
---
## What does this tool do?

This tool counts how many times each individual character appears in a block of text and lists them from most to least frequent, along with each character's share of the total as a percentage. It is the character-level counterpart to [word_frequency](/util/word_frequency/), useful for anything from a quick sanity check on text to classic exercises like letter-frequency analysis in cryptography.

```example
title: the default table, most frequent character first
input: hello
output: l  2  40.00%
e  1  20.00%
h  1  20.00%
o  1  20.00%
```

## How it works

Every character in the input is counted, including punctuation and digits. Characters are counted as whole Unicode code points, so an astral character such as 😀 is one entry, never two surrogate halves; an emoji built from several code points (a flag, a skin-toned emoji) is counted as its separate parts. Rows are sorted by count, highest first; characters tied on count are then ordered by their Unicode code point, which is why in the example above `e`, `h`, and `o` (all appearing once) are listed alphabetically after `l`.

By default, whitespace characters (spaces, tabs, newlines) are excluded from the count entirely, since in most text they are just separators rather than meaningful content. Turning on **include whitespace** counts them too, displaying each one with a readable stand-in (a space becomes `␣`, a newline becomes `\n`), so the table stays legible instead of showing blank cells.

```example
title: whitespace is counted and shown readably when included
params: {"includeWhitespace": true}
input: a b
output: ␣  1  33.33%
a  1  33.33%
b  1  33.33%
```

Turning on **ignore case** folds letters together before counting, so `A` and `a` are tallied as the same character. The lowercase form is used as the label, unless lowercasing would itself change the number of characters (as with the Turkish dotted capital `İ`), in which case that character is left as its own entry to avoid merging things that are not really the same letter.

```example
title: ignore case merges upper and lower case letters together
params: {"ignoreCase": true}
input: AaB
output: a  2  66.67%
b  1  33.33%
```

## Options

- **top n (0 = all)**: limits the table to the N most frequent characters; `0` (the default) shows all of them.
- **ignore case**: folds letters together regardless of case before counting (default off).
- **include whitespace**: counts spaces, tabs, and newlines instead of skipping them (default off).
- **format**: `table` (aligned columns, the default), `json` (an object with `totalCharacters`, `uniqueCharacters`, and a `characters` array), or `csv`.
- **show percent**: includes each character's percentage of the total (default on); turning it off drops that column from every format.

```example
title: json output includes totals alongside each character's count
params: {"format": "json", "top": 2}
input: banana
output: {
  "totalCharacters": 6,
  "uniqueCharacters": 3,
  "characters": [
    {
      "char": "a",
      "codePoint": "U+0061",
      "count": 3,
      "percent": 50
    },
    {
      "char": "n",
      "codePoint": "U+006E",
      "count": 2,
      "percent": 33.33
    }
  ]
}
```

## Common uses

- Classic letter-frequency analysis, such as inspecting ciphertext before trying to break a substitution cipher.
- Spotting which characters dominate a piece of text, which is useful when auditing generated or scraped content.
- Feeding character counts into another tool or report, using the CSV or JSON output.
- Checking for unexpected or invisible characters: the table labels them with their `U+XXXX` value instead of letting them vanish, and the JSON and CSV output give every character's code point.

## Tips and pitfalls

- In the table, characters with no visible glyph (control characters, zero-width spaces, lone surrogates) are shown by their Unicode code point (like `U+200B`) instead of printing invisible garbage. Some invisible characters, such as the byte order mark U+FEFF and non-breaking spaces, count as whitespace, so they only appear with **include whitespace** on.
- The CSV output quotes a cell whenever the character itself is a comma, quote, newline, or whitespace, so the file stays valid to re-import elsewhere.
- Case folding only merges two characters when lowercasing keeps the result to a single character; a handful of characters lowercase into two characters and are deliberately kept separate rather than merged incorrectly.
- For counting whole words instead of individual characters, use [word_frequency](/util/word_frequency/); for overall totals rather than a per-character breakdown, [count](/util/count/) and [length](/util/length/) are simpler.
