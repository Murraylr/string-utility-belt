---
title: Word and Character Counter: Count Text Online
description: Count characters, words, and lines in text online in one step, similar to the classic Unix wc command, with a plain-text summary.
---
## What does this tool do?

This tool reports three basic statistics about a block of text at once: how many characters it contains, how many words, and how many lines. It is the same idea as the Unix `wc` command, reported as a labeled summary (the counting rules differ slightly; see the tips).

```example
title: a couple of lines of text
input: Hello world
foo bar baz
output: characters: 23
words: 5
lines: 2
```

## How it works

- **characters** is the raw JavaScript length of the text, in UTF-16 code units. Every character counts, including spaces, punctuation, and newlines (emoji are covered in the tips below).
- **words** is the number of whitespace-separated tokens once the text is trimmed: runs of spaces, tabs, or newlines between words all count as a single separator, so extra spacing between words never inflates the word count.
- **lines** is the number of newline-separated segments. A single line of text with no line break at all still counts as one line, and an empty input counts as zero lines.

```example
title: repeated spaces between words do not add extra words
input: a   b   c
output: characters: 9
words: 3
lines: 1
```

A subtlety worth knowing: a string made up entirely of whitespace still has a length and still counts as one line, even though it contains zero words.

```example
title: whitespace-only input has characters and a line, but no words
input:
   
output: characters: 3
words: 0
lines: 1
```

Empty input reports all three statistics as zero:

```example
title: empty input
input:
output: characters: 0
words: 0
lines: 0
```

## Options

This utility has no configurable options; it always reports characters, words, and lines together.

## Common uses

- A quick sanity check on pasted or generated text before using it somewhere with a length limit.
- Comparing before-and-after statistics across a pipeline, to confirm a transformation changed (or didn't change) the shape of the text as expected.
- Getting a fast overview of a document's size without opening it in a full editor.
- Scripting or automation contexts where you want the classic `wc`-style summary as plain text rather than separate numbers.

## Tips and pitfalls

- The **words** count is based purely on whitespace-separated tokens, so a lone dash or emoji counts as a word and `hello,world` counts as one. [word_frequency](/util/word_frequency/) (with its default **strip punctuation**) skips tokens with no letters or digits and splits at punctuation other than internal apostrophes and hyphens, so the two tools can report different word counts on the same text.
- The **lines** count reflects how many newline-separated segments exist, not how many lines of *visible content* there are. A line break at the very end still adds one to the count. That makes it one more than `wc -l` reports for any non-empty text, since `wc -l` counts line-break characters; `wc -c` also counts bytes, not UTF-16 code units. If you only want the character length by itself, [length](/util/length/) is more direct; if you only want blank lines gone before counting, run [remove_blank_lines](/util/remove_blank_lines/) first.
- Because character count is a plain JavaScript string length, characters outside the Basic Multilingual Plane (many emoji) count as two rather than one, the same measurement [length](/util/length/) uses.
- This tool always returns its three statistics as a small text report rather than a single number, which makes it easy to read directly but less convenient if you need just one of the three values programmatically. In that case, use [length](/util/length/) for characters alone.
