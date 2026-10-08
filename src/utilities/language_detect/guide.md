---
title: Language Detection Online: Identify Text Language
description: Detect a text's language and get its ISO 639-3 code, English name, dominant script, a confidence score, and ranked alternative candidates.
---
## What does language detection do?

Given a piece of text, this tool guesses which natural language it's written in and reports its
[ISO 639-3](https://en.wikipedia.org/wiki/ISO_639-3) three-letter code, an English name for the language,
the dominant writing script, a confidence score from 0 to 1, and a short ranked list of alternative
languages it also considered. It combines two signals: which Unicode script the text is mostly written in
(Latin, Cyrillic, Han, Hangul, and so on), and statistical language identification based on character
trigrams, provided by the `franc-min` library, which covers the 82 languages that have 8 million or more
speakers.

## How it works

For text of at least 10 characters in a language `franc-min` knows, the trigram detector does the work.
It only compares languages written in the text's dominant script, and scores them relative to the winner
(which always scores 1), so the scores are rankings, not probabilities. The exact figures below come from
the library's trigram data and can shift slightly between library versions:

```example
title: a plain English sentence
output-matches: ^\{\n  "code": "eng",\n  "language": "English",\n  "script": "Latin",\n  "confidence": [\d.]+,\n  "alternatives": \[[\s\S]*\]\n\}$
input: The quick brown fox jumps over the lazy dog near the riverbank at dawn.
output:
{
  "code": "eng",
  "language": "English",
  "script": "Latin",
  "confidence": 0.18,
  "alternatives": [
    {
      "code": "fra",
      "language": "French",
      "score": 0.96
    },
    {
      "code": "hnj",
      "language": "Hmong Njua",
      "score": 0.87
    },
    {
      "code": "ind",
      "language": "Indonesian",
      "score": 0.84
    },
    {
      "code": "por",
      "language": "Portuguese",
      "score": 0.82
    },
    {
      "code": "ita",
      "language": "Italian",
      "score": 0.81
    }
  ]
}
```

`confidence` is this tool's own measure, built from two things: how much text there was (it stops
growing at about 60 letters, or 15 for Chinese, Japanese, Korean, Thai, Lao and Khmer) and how far the
winner is ahead of the runner-up: a runner-up score 0.25 or more behind counts as a clean win. In the
example the guess is right, but French scored 0.96 against English's 1, so the margin (and with it the
confidence) is small. Short sentences in Latin-script languages often land close together like this.

When `franc-min` returns nothing (the text is under 10 characters, or its script is not one the library
covers), the tool falls back to the script alone. Several scripts map straight to one language here: kana
to Japanese, Hangul to Korean, Han without kana to Mandarin Chinese, Greek to Greek, Hebrew to Hebrew, Thai
to Thai, and so on. A fallback result has no alternatives and a confidence of 0.4 to 0.95 depending on
length. Five hiragana characters are too short for trigrams, but kana is only used for Japanese:

```example
title: text too short for trigram statistics still resolves through its script
input: こんにちは
output:
{
  "code": "jpn",
  "language": "Japanese",
  "script": "Japanese",
  "confidence": 0.58,
  "alternatives": []
}
```

The same fallback also covers languages `franc-min` doesn't include at all. Hebrew isn't one of the
languages the trigram library recognizes, but the Hebrew script itself is enough to name the language:

```example
title: a language the trigram detector doesn't know, resolved by script alone
input: שלום עולם
output:
{
  "code": "heb",
  "language": "Hebrew",
  "script": "Hebrew",
  "confidence": 0.47,
  "alternatives": []
}
```

Text with no letters at all (empty input, whitespace, digits, or punctuation-only text) returns `und`
(undetermined) with zero confidence and no alternatives, rather than a guess. So does text under 10
characters in a script many languages share, such as Latin, Cyrillic, Arabic or Devanagari: `Привет` is
too short for trigrams, and Cyrillic alone could be Russian, Ukrainian, Bulgarian or several others.

## Output fields

- **code**: the detected language's ISO 639-3 code, or `und` when nothing could be determined.
- **language**: an English name for that code (`Mandarin Chinese`, `Hebrew`, and so on); unrecognized
  codes are passed through unchanged.
- **script**: the script with the most letters in the text (`Latin`, `Cyrillic`, `Japanese` when any
  kana is present, `Han` for Han characters without kana, `Unknown` when no letters in a recognized script
  were found).
- **confidence**: 0 to 1, this tool's own heuristic rather than a probability. Combines how much text was
  available with (when trigram statistics ran) how far ahead the winner is over the second-place
  language; a winner that matches a single-language script such as Greek or Hangul counts as a near-clean
  win.
- **alternatives**: up to five runner-up languages with `franc-min`'s relative scores (the winner would be
  1). Empty when the result came from the script-only fallback, or when the library itself maps the
  script to a single language.

This utility has no configurable parameters. Paste in text and it returns the report above.

## Common uses

- Automatically routing or tagging user-submitted text (comments, reviews, support tickets) by language
  before translation or filtering.
- Sanity-checking that a document or dataset column actually contains the language it's labeled as.
- Checking how close a call was, using the `alternatives` list to see which other languages of the same
  script scored nearly as well.

## Tips and pitfalls

- Very short or generic sentences in a widely-spoken language often produce a lower confidence than you
  might expect, even when the top guess is right. The alternatives list exists precisely because closely
  related languages can share a lot of character-level structure.
- Detection works on whichever script dominates the sample; for text that mixes two scripts (say, Latin
  words inside a mostly-Cyrillic sentence), only languages written in the majority script are considered.
  It reports one language per input, so it cannot tell you that a text is half English and half French.
- Languages outside `franc-min`'s 82 are never named unless their script maps to them directly (as with
  Hebrew); a text in a smaller Latin-script language will be reported as whichever covered language it
  most resembles.
- This tool identifies natural language, not text encoding or file format. For guessing whether a string
  is JSON, base64, a URL, or another structured format, use [detect format](/util/detect_format/) instead.
- Once you know the language, pair this with [readability scores](/util/readability/) or
  [text statistics](/util/text_stats/) for further analysis. Note that the readability formulas assume
  English, and text statistics counts words by spaces, so Chinese or Japanese text without spaces counts
  as very few words.
