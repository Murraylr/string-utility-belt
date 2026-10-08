---
title: Readability Score Calculator: Flesch, Fog, SMOG Online
description: Score English text with Flesch Reading Ease, Flesch-Kincaid, Gunning Fog, SMOG, Coleman-Liau, and ARI, as JSON or a plain-text report.
---
## What are readability formulas?

Readability formulas estimate how hard a piece of writing is to read, usually expressed as a school grade
level. Most date from the 1940s to the 1970s (Flesch–Kincaid, for example, was calibrated for US Navy
training manuals), and they all work the same basic way: count words, sentences, and syllables (or
letters), and plug the counts into a formula. This tool runs the text through six of the best-known formulas at once:
[Flesch Reading Ease](https://en.wikipedia.org/wiki/Flesch%E2%80%93Kincaid_readability_tests),
Flesch-Kincaid Grade Level, Gunning Fog, SMOG, Coleman-Liau, and the Automated Readability Index. It then
averages the five grade-level formulas into one overall estimate.

## How it works

The text is split into words and sentences, and every word's syllables are counted with a heuristic
English vowel-group counter (with a small exception list for words like "business" and contractions like
"didn't"), not a pronunciation dictionary, so individual words can be off by a syllable. Those counts
feed all six formulas at once:

```example
title: two short, simple sentences
input: The cat sat on the mat. It was a sunny day.
output:
{
  "fleschReadingEase": 100,
  "fleschReadingEaseLabel": "very easy",
  "fleschKincaidGrade": 0,
  "gunningFog": 2.2,
  "smog": 3.13,
  "colemanLiau": 0,
  "automatedReadabilityIndex": 0,
  "averageGrade": 1.07,
  "readingLevel": "elementary school",
  "words": 11,
  "sentences": 2,
  "syllables": 12,
  "characters": 43,
  "letters": 31,
  "complexWords": 0,
  "polysyllabicWords": 0,
  "avgWordsPerSentence": 5.5,
  "avgSyllablesPerWord": 1.09,
  "avgLettersPerWord": 2.82
}
```

Flesch Reading Ease is clamped here to the range 0 (very hard) to 100 (very easy) and reported with
Flesch's plain-English label (90+ very easy, 80+ easy, 70+ fairly easy, 60+ standard, 50+ fairly
difficult, 30+ difficult, below 30 very confusing). The other five formulas are US grade levels, floored
at 0, where a higher number means harder to read. `averageGrade` is the mean of those five, and
`readingLevel` translates it into elementary school (below 6), middle school (6–8), high school (9–12),
college (13–16), or graduate (17+).

With W words, S sentences, Y syllables and L letters (letters and digits), the formulas are:

| Formula | Calculation |
| --- | --- |
| Flesch Reading Ease | 206.835 − 1.015 × W/S − 84.6 × Y/W |
| Flesch–Kincaid Grade | 0.39 × W/S + 11.8 × Y/W − 15.59 |
| Gunning Fog | 0.4 × (W/S + 100 × complex words / W) |
| SMOG | 1.043 × √(polysyllabic words × 30 / S) + 3.1291 |
| Coleman–Liau | 0.0588 × (100 × L/W) − 0.296 × (100 × S/W) − 15.8 |
| Automated Readability Index | 4.71 × L/W + 0.5 × W/S − 21.43 |

A denser paragraph with longer words and sentences scores harder on most formulas. SMOG only moves once
words of three or more syllables appear, so it stays put here:

```example
title: a longer paragraph with varied sentence and word length
input: The quick brown fox jumps over the lazy dog. It was a bright cold day in April, and the clocks were striking thirteen. Winston Smith slipped quickly through the glass doors.
output:
{
  "fleschReadingEase": 92.64,
  "fleschReadingEaseLabel": "very easy",
  "fleschKincaidGrade": 2.9,
  "gunningFog": 4.13,
  "smog": 3.13,
  "colemanLiau": 7.7,
  "automatedReadabilityIndex": 4.86,
  "averageGrade": 4.54,
  "readingLevel": "elementary school",
  "words": 31,
  "sentences": 3,
  "syllables": 38,
  "characters": 173,
  "letters": 139,
  "complexWords": 0,
  "polysyllabicWords": 0,
  "avgWordsPerSentence": 10.33,
  "avgSyllablesPerWord": 1.23,
  "avgLettersPerWord": 4.48
}
```

`complexWords` (Gunning Fog's count of 3-or-more-syllable words) and `polysyllabicWords` (SMOG's plain
3-or-more-syllable count) can differ, because the Fog count skips a word whose `-es`, `-ed` or `-ing`
ending is what pushes it to three syllables: "beginning" counts for SMOG but not for Fog, while
"developing" counts for both. (Gunning's other exclusions, such as proper nouns and compound words, are
not applied.) Long Latinate vocabulary pushes every grade score up sharply: here both counts are 10 out
of 13 words:

```example
title: dense, multi-syllable vocabulary pushes every score toward "graduate"
input: The unprecedented institutionalisation of administrative responsibilities necessitates considerable organisational reconfiguration throughout multinational corporations.
output:
{
  "fleschReadingEase": 0,
  "fleschReadingEaseLabel": "very confusing",
  "fleschKincaidGrade": 41.22,
  "gunningFog": 35.97,
  "smog": 21.19,
  "colemanLiau": 52.48,
  "automatedReadabilityIndex": 41.59,
  "averageGrade": 38.49,
  "readingLevel": "graduate",
  "words": 13,
  "sentences": 1,
  "syllables": 57,
  "characters": 169,
  "letters": 156,
  "complexWords": 10,
  "polysyllabicWords": 10,
  "avgWordsPerSentence": 13,
  "avgSyllablesPerWord": 4.38,
  "avgLettersPerWord": 12
}
```

Setting **output format** to `text` renders the same figures as a short readable report instead:

```example
title: a text report for two short sentences
input: The cat sat on the mat. The dog ran fast.
params: {"format": "text"}
output:
flesch reading ease:        100 (very easy)
flesch-kincaid grade:       0
gunning fog:                2
smog:                       3.13
coleman-liau:               0
automated readability:      0

estimated grade:            1.03 (elementary school)
words:                      10
sentences:                  2
syllables:                  10
complex words:              0
polysyllabic words:         0
avg words / sentence:       5
avg syllables / word:       1
```

## Options

- **output format**: `json` (default, the full report shown above) or `text` (the same figures as a short
  readable report).

## Common uses

- Checking whether marketing copy, help documentation, or a blog post is written at an appropriate reading
  level for its audience.
- Comparing drafts before and after an editing pass to confirm a simplification actually simplified things.
- Flagging overly dense legal, technical, or academic writing before it's published to a general audience.

## Tips and pitfalls

- Every formula here was calibrated on English, and the syllable-based ones rely on an English-specific
  syllable-counting heuristic; running non-English text through it will produce numbers, but they don't
  mean anything for another language's readability. Run [language detect](/util/language_detect/) first
  if you're not sure.
- Sentence splitting recognizes common abbreviations (`Mr.`, `Dept.`, `etc.`), initials (`J. R. R.`), and
  decimals (`3.5`) so they don't get counted as sentence breaks, and treats a blank line as a break (so a
  heading counts as a sentence). Abbreviations not on its list may still split a sentence early, and a
  listed one such as `etc.` never ends a sentence, even when it really does.
- SMOG was designed for samples of 30 sentences; on shorter text the tool scales the polysyllable count
  up to 30 sentences, so SMOG (like every formula here) is shaky on a sentence or two.
- These formulas measure surface complexity (word and sentence length, syllable count), not whether the
  content itself is clear or well-organized. A short, jargon-free sentence can still be confusing, and
  these scores won't catch that.
- For a plain word, sentence, and character count without the grade-level scoring, see
  [text statistics](/util/text_stats/); for a rough time-to-read estimate instead of a difficulty score,
  see [reading time](/util/reading_time/).
