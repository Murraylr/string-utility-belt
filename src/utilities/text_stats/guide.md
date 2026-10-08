---
title: Text Statistics Online: Count Words, Chars & Sentences
description: Count characters, graphemes, words, sentences, paragraphs, lines, and bytes in your text, with averages, as JSON or a plain-text report.
---
## What does this measure?

This tool gives you a full statistical breakdown of a piece of text: how many characters, "real" visual
characters (graphemes), words, unique words, sentences, paragraphs, and lines it has, its size in bytes,
a couple of useful averages, and the single longest word and line. It's the kind of summary a word
processor's "word count" dialog shows, extended with a few extra measures that are useful for developers:
UTF-8/UTF-16 byte counts, unique word count, and grapheme count in particular.

## How it works

Every count is computed from the same text, so you get the full picture from one run:

```example
title: a short sentence
input: Hello world. This is great!
output:
{
  "characters": 27,
  "charactersNoSpaces": 23,
  "graphemes": 27,
  "words": 5,
  "uniqueWords": 5,
  "sentences": 2,
  "paragraphs": 1,
  "lines": 1,
  "nonEmptyLines": 1,
  "bytesUtf8": 27,
  "bytesUtf16": 54,
  "avgWordLength": 4.2,
  "avgWordsPerSentence": 2.5,
  "longestWord": "Hello",
  "longestLine": 27
}
```

`characters` counts UTF-16 code units (JavaScript's native string length), while `graphemes` counts what a
person would actually perceive as one character (via `Intl.Segmenter`, or code points
where that is unavailable). The two only diverge once the text has emoji, combining accents, or other
multi-code-unit sequences. In this example the emoji makes them diverge; the precomposed `é` does not,
since it is a single code unit:

```example
title: an emoji makes characters and graphemes diverge
input: héllo 😀
output:
{
  "characters": 8,
  "charactersNoSpaces": 7,
  "graphemes": 7,
  "words": 1,
  "uniqueWords": 1,
  "sentences": 1,
  "paragraphs": 1,
  "lines": 1,
  "nonEmptyLines": 1,
  "bytesUtf8": 11,
  "bytesUtf16": 16,
  "avgWordLength": 5,
  "avgWordsPerSentence": 1,
  "longestWord": "héllo",
  "longestLine": 7
}
```

Here `😀` alone takes 2 UTF-16 code units (a surrogate pair) but is one grapheme, and it isn't counted as a
word at all: words must contain at least one letter or digit. `bytesUtf8` (11) is larger than
`characters` (8) because both `é` and `😀` take more than one byte in UTF-8.

Setting **format** to `text` renders the same numbers as a short, human-readable report instead of JSON:

```example
title: a text report
input: Hello world. This is great!
params: {"format": "text"}
output:
characters:             27
characters (no spaces): 23
graphemes:              27
words:                  5
unique words:           5
sentences:              2
paragraphs:             1
lines:                  1
non-empty lines:        1
bytes (utf-8):          27
bytes (utf-16):         54
avg word length:        4.2
avg words per sentence: 2.5
longest word:           Hello
longest line (chars):   27
```

## Options

- **format**: `json` (default, the full breakdown shown above) or `text` (the same numbers as a short
  readable report).

## Things to know

- A "word" is a run of non-space characters with leading and trailing punctuation stripped, so `"word,"`
  and `"(word)"` both measure as `word`. But a token made entirely of punctuation, like a lone `-` or
  `...`, doesn't count as a word at all and is left out of `words`, `uniqueWords`, `avgWordLength`, and
  `longestWord`.
- Words are split on whitespace only, so text written without spaces counts as very few words: the
  Chinese or Japanese phrase `日本語のテキスト` is one word here, whereas
  [reading time](/util/reading_time/) counts each of its characters as a word.
- `uniqueWords` is case-folded (`Cat` and `cat` count as the same word) but `longestWord` keeps its
  original casing and accents.
- Sentence counting looks for `.`, `!`, `?`, or `…` followed by optional closing quotes and then
  whitespace or the end of the text, so a decimal like `3.5` never splits a sentence but an abbreviation
  does: `Mr. Smith left.` counts as two sentences. [Readability scores](/util/readability/) uses a smarter
  splitter that knows common abbreviations and initials.
- `paragraphs` counts blocks of text separated by a blank line; a document with no blank lines is one
  paragraph no matter how many lines it has.
- `lines` is the number of line breaks plus one (LF, CRLF and lone CR all count), so a trailing newline
  adds an empty final line to the total; `nonEmptyLines` excludes lines that are blank or only whitespace.

## Common uses

- Getting a word or character count for a piece of writing, with Unicode-aware character and grapheme
  counts for text with emoji or accented characters.
- Checking a string's byte size in UTF-8 before it goes into a field, message, or protocol with a byte
  limit.
- Quick document statistics (sentence and paragraph counts) for editorial or content-length review.

## Tips and pitfalls

- If you need a difficulty score rather than a raw count, see [readability scores](/util/readability/); for
  a rough "time to read" estimate, see [reading time](/util/reading_time/). Each uses its own word and
  sentence rules, so their counts can differ from the ones here.
- `charactersNoSpaces` removes all Unicode whitespace, not just plain spaces, so tabs and line breaks are
  excluded too.
- Byte counts assume UTF-8 (`bytesUtf8`) and UTF-16 (`bytesUtf16`, always exactly twice `characters`).
  Neither reflects a different encoding your target system might actually use.
