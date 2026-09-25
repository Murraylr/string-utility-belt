---
title: Reading Time Calculator Online — Estimate Read Time
description: Estimate how long an article or draft takes to read at any words-per-minute pace, as a one-line summary or JSON with the word count.
---
## What does this calculate?

This is the same kind of "X min read" estimate you see at the top of blog posts and articles. It counts
the words in your text and divides by a reading speed (in words per minute) to estimate how long it takes
an average reader to get through it — nothing more sophisticated than that, which is the same basic
calculation behind most "min read" labels (some platforms add extra time for images).

## How it works

A word is a run of letters, digits and combining marks, which may contain an internal `.`, apostrophe or
hyphen (so `3.5`, `don't` and `state-of-the-art` each count once); punctuation and emoji on their own are
not words. The total is divided by the chosen words-per-minute rate and rounded to whole seconds. Short
text reads in under a minute at the default rate of 200 words per minute:

```example
title: a short phrase reads in under a minute
input: hello world
output: less than a minute read (2 words at 200 wpm)
```

Change **words per minute** to model a slower or faster reader — lowering it stretches the same text into
a longer estimate, and once the total reaches a full minute the output switches to a minute count, rounded
up (1 minute 30 seconds is reported as "2 min read"):

```example
title: a slower reading speed for a short paragraph
params: {"wordsPerMinute": 30}
input: Reading time estimates help writers and editors judge how long a piece of prose will take an average reader to finish, which is useful for blog posts, newsletters, and long-form articles where readers decide whether to commit based on the estimate shown near the title.
output: 2 min read (45 words at 30 wpm)
```

The estimate switches from "less than a minute" to "N min read" once the rounded total reaches 60 seconds
(so 199 words at 200 wpm — 59.7 seconds — already reads as "1 min read"):

```example
title: exactly one minute switches the wording
params: {"wordsPerMinute": 10}
input: The quick brown fox jumps over the lazy sleeping dog
output: 1 min read (10 words at 10 wpm)
```

Set **output format** to `json` to get the full breakdown instead of the one-line summary. This also shows
how mixed-script text is counted: Chinese, Japanese and Korean characters are each treated as their own
word:

```example
title: json format, mixing CJK and Latin words
params: {"format": "json"}
input: hello 世界
output:
{
  "words": 3,
  "wordsPerMinute": 200,
  "totalSeconds": 1,
  "minutes": 0,
  "seconds": 1,
  "roundedMinutes": 1,
  "duration": "1 second",
  "text": "less than a minute read (3 words at 200 wpm)"
}
```

## Options

- **words per minute** — the assumed reading speed, 200 by default (a common, slightly conservative
  figure for adult silent reading; estimates of roughly 200–260 are typical). Must be a positive whole
  number.
- **output format** — `text` (default, the one-line summary shown above) or `json` (the full breakdown:
  word count, total seconds, minutes and seconds, a rounded-up minute count, a human duration, and the
  same one-line summary as `text`).

## Common uses

- Showing an "X min read" label on blog posts, documentation pages, or long-form articles.
- Estimating how long a script, transcript, or set of speaker notes will take to read aloud — lower
  **words per minute** for this, since speech is usually slower than silent reading (figures around 130–160
  wpm are common).
- Comparing draft lengths across several pieces of content at a glance.

## Tips and pitfalls

- Word counting treats Chinese, Japanese, and Korean text specially: each Han, Hiragana, Katakana, or
  Hangul character is counted as its own "word" rather than trying to segment the text into real words,
  because Chinese and Japanese are written without spaces. Korean does put spaces between words, but its
  syllable blocks are counted one by one too, so Korean text gets a noticeably higher count and a longer
  estimate. Everything else is counted by the letter-and-digit rule above.
- This is a word-count estimate, not a true reading-speed model — it does not account for images, code
  blocks, tables, unusually dense or technical vocabulary, or a reader's familiarity with the subject. For
  a difficulty-aware measure instead of a time estimate, see [readability scores](/util/readability/).
- For word, sentence, and character counts on their own (without a time estimate), see
  [text statistics](/util/text_stats/) — note that it splits words on spaces and does not count CJK
  characters individually, so its word count can differ from the one used here.
