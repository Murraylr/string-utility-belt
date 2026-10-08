---
title: Lorem Ipsum Generator: Placeholder Text Online
description: Generate lorem ipsum placeholder text online by paragraphs, sentences, words or exact byte count, with or without the classic opening line.
---
## What is lorem ipsum?

Lorem ipsum is scrambled, nonsensical Latin text used as filler content in designs and layouts, so that a reader's attention goes to the visual design rather than to reading (and judging) placeholder copy. Its text traces back to a passage from Cicero's *De Finibus Bonorum et Malorum*, but words have been cut, scrambled, and altered so much that it no longer reads as real Latin. This tool generates it in four units (paragraphs, sentences, words, or an exact byte count) from a vocabulary of the classic lorem ipsum words.

## How it works

Ask for a number of words, and by default the output starts with the familiar opening:

```example
title: five words, starting with "Lorem ipsum"
input:
params: {"unit": "words", "count": 5}
output: lorem ipsum dolor sit amet
```

Turning the classic opener off draws every word randomly from the vocabulary instead:

```example
title: five words without the classic opener (seeded for a reproducible example)
input:
params: {"unit": "words", "count": 5, "startWithLorem": false, "seed": 11}
output: distinctio tempore possimus quod laboriosam
```

The `sentences` unit works the same way. With the opener on, the very first sentence is always the full classic opening line, and any further sentences are freshly generated:

```example
title: a seeded sentence without the classic opener
input:
params: {"unit": "sentences", "count": 1, "startWithLorem": false, "seed": 42}
output: Cupiditate laboriosam voluptates commodo libero cupidatat assumenda commodi animi pariatur unde.
```

Turning on `html` wraps the output in `<p>` tags. For the `words` unit, that means the whole line is wrapped once:

```example
title: five words wrapped in a paragraph tag
input:
params: {"unit": "words", "count": 5, "html": true}
output: <p>lorem ipsum dolor sit amet</p>
```

The `bytes` unit produces an exact byte count rather than an exact word or sentence count, which is useful for testing fixed-width fields or byte-limited inputs. Since the vocabulary is pure ASCII, one character is one UTF-8 byte, so the text is simply truncated at the requested length (with `html` on, the `<p>` tags come on top of that count):

```example
title: an exact 60-byte excerpt, starting with the classic opener
input:
params: {"unit": "bytes", "count": 60}
output: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed
```

## Options

- **unit**: `paragraphs` (default, each one 3–6 sentences), `sentences` (each one 6–14 words, occasionally with an inserted comma), `words`, or `bytes` (an exact UTF-8 byte count, truncating mid-word if necessary).
- **count**: how many of the chosen unit to generate; default `3`, from 0 to 1,000 for every unit (so `bytes` tops out at 1,000 bytes). A count of `0` returns an empty string.
- **start with "Lorem ipsum"**: on by default; makes the very first paragraph, sentence, or run of words begin with the traditional `"Lorem ipsum dolor sit amet…"` opening. Every unit after the first is always freshly generated regardless of this setting.
- **wrap in `<p>` tags**: off by default. For `paragraphs`, each paragraph gets its own `<p>...</p>` on its own line; for the other units, the whole output is wrapped once.
- **seed (0 = random)**: `0` (the default) draws fresh randomness from the browser's cryptographic random number generator on every run. Any other integer reproduces the exact same text every time, which is what makes several of the examples on this page reproducible.

## Common uses

- Filling in body copy for a design mockup or template before real content exists.
- Testing how a layout handles a specific, exact amount of text. The `bytes` unit is useful here since word and sentence counts vary in length.
- Testing HTML rendering of paragraph markup with the `html` option, without needing real copy.

## Tips and pitfalls

- Because `startWithLorem` only affects the very first unit generated, asking for `sentences` with a count greater than 1 still gives you fresh random sentences after the first one. The whole output is not the single fixed opening line repeated.
- This tool ignores its input entirely. The input box has no effect on the generated text.
- For structured placeholder values instead of prose (names, emails, addresses), see [fake data](/util/fake_data/); for a template that repeats and substitutes values into a pattern, see [template expand](/util/template_expand/).
- To pad or trim generated text to an exact length after the fact, see [pad](/util/pad/) or [truncate](/util/truncate/).
