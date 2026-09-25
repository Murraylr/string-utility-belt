---
title: Unicode Normalize Online — NFC, NFD, NFKC, NFKD
description: Normalize Unicode text online to NFC, NFD, NFKC, or NFKD form, so canonically equivalent strings compare as equal.
---
## What is Unicode normalization?

The same visible character can be stored as different sequences of Unicode code points. The letter `é` can be one precomposed code point, or it can be a plain `e` followed by a separate **combining acute accent** mark that renders on top of it — two different byte sequences that look identical on screen. This causes real bugs: a string comparison, a search, or a database lookup can silently fail because two "equal-looking" strings are not equal at the code-point level. Unicode normalization ([UAX #15](https://unicode.org/reports/tr15/)) fixes this by rewriting text into one of four standard forms, so equivalent text normalized to the same form ends up identical, code point for code point.

## The four forms

- **NFC** (Canonical Composition, the default) — combines a base letter and its combining marks into a single precomposed character wherever one exists. This is the form most text on the web and in most files is already in.
- **NFD** (Canonical Decomposition) — the opposite: splits every precomposed character back into its base letter plus separate combining marks.
- **NFKC** (Compatibility Composition) — like NFC, but also folds "compatibility" variants that represent the same character differently for formatting reasons — for example, the ligature `ﬁ` becomes the two ordinary letters `f` and `i`.
- **NFKD** (Compatibility Decomposition) — the same compatibility folding as NFKC, but decomposed instead of recomposed, so accented letters end up split into base letter plus marks.

```example
title: NFC composes a base letter and a combining accent into one character
params: {"form": "NFC"}
input: é
output: é
```

The example above looks like a no-op, but it is not: the **input** is two code points (a plain `e` followed by a separate combining acute accent), and the **output** is the single precomposed `é` character. Both render identically, which is exactly the problem normalization solves — you cannot tell them apart by eye.

## How it works

Decomposition (NFD, NFKD) works in the opposite direction, splitting a precomposed character apart:

```example
title: NFD splits a precomposed character into a base letter plus an accent
params: {"form": "NFD"}
input: é
output: é
```

Here the **input** is the single precomposed `é`, and the **output** is two code points — `e` followed by a standalone combining acute accent — again visually indistinguishable from the input. This is why a plain character count is a useful way to confirm normalization actually happened when you cannot see the difference: an NFD-normalized `é` is two characters long where its NFC form is one.

Compatibility folding goes further than plain composition or decomposition — it also standardizes characters that exist mainly for legacy formatting reasons, such as typographic ligatures:

```example
title: NFKC folds a ligature into its plain letters
params: {"form": "NFKC"}
input: ﬁle
output: file
```

## Options

- **form** — one of `NFC` (default), `NFD`, `NFKC`, or `NFKD`, as described above.

## Common uses

- Normalizing user input — names, search queries, form fields — before comparing, deduplicating, or storing it, so the same text typed or pasted in different ways is recognized as equal.
- Preparing text before hashing, signing, or generating a checksum, since two byte-different-but-visually-equal strings would otherwise hash differently.
- Cleaning up text pasted from sources (word processors, PDFs, other operating systems) that may use decomposed characters, before further processing.
- Folding ligatures and other compatibility characters (NFKC/NFKD) before a search, a slug, or any system that only expects the plain underlying letters.

## Tips and pitfalls

- NFC and NFKC always make text shorter than or equal in code-point length to their decomposed counterparts, and NFD/NFKD always make it the same length or longer, because composition merges code points and decomposition splits them.
- Compatibility folding (NFKC/NFKD) is lossy in the sense that formatting distinctions disappear: a ligature and its separate letters become indistinguishable after NFKC, which is usually what you want for search and comparison, but not if you need to preserve the original typography.
- If padding, chunking, or measuring length gives surprising results on accented text, the input is probably in decomposed form; run this tool with NFC first — [pad](/util/pad/) counts UTF-16 code units and [chunk](/util/chunk/) counts code points, and under either measure a decomposed accented letter counts as two.
- Normalization does not remove accents — it only standardizes how they are represented. To strip accents entirely, use [diacritics](/util/diacritics/), which normalizes to NFD internally and then deletes the accents in the Combining Diacritical Marks block (U+0300–U+036F).
- This tool does not transliterate between scripts (Cyrillic to Latin, for example); it only standardizes different encodings of the same underlying characters. Look-alike characters from different scripts, such as Latin `a` and Cyrillic `а`, stay different under every form.
