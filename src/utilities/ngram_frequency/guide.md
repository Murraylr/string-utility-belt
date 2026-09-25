---
title: N-gram Frequency Analyzer — Find Common Word Pairs
description: Count the most common word or character n-grams in text online — bigrams, trigrams, and beyond — with case folding and table or JSON output.
---
## What is an n-gram?

An n-gram is a run of **n** consecutive units from a piece of text — words or characters — treated as one item. With `n` set to 2, "the cat sat" contains the word bigrams "the cat" and "cat sat"; with `n` set to 3, it contains the trigram "the cat sat". This tool counts how often each n-gram occurs and lists the most common ones, which is a standard technique behind autocomplete suggestions, language models, and finding recurring phrases or letter patterns in text.

```example
title: the most common word bigrams
params: {"n": 2, "top": 3}
input: the cat sat on the mat
output: cat sat  1
on the   1
sat on   1
```

## How it works

With **unit** set to `words` (the default), the text is first split into words — runs of letters and digits that may include an internal apostrophe or hyphen — and then every overlapping run of **n** consecutive words becomes one n-gram, joined back together with a single space for display. With **unit** set to `characters`, the same sliding window runs over individual Unicode characters instead — every character, including spaces and punctuation — with no separator between them.

```example
title: character trigrams slide one character at a time
params: {"n": 3, "unit": "characters"}
input: abcabc
output: abc  2
bca  1
cab  1
```

Every possible window is counted, sliding forward one unit at a time, so a run of the same character or phrase produces overlapping n-grams rather than just non-overlapping chunks — this is why `abcabc` produces the overlapping trigrams `abc`, `bca`, `cab`, and `abc` again (two occurrences of `abc` total), not just two clean halves.

## Options

- **n (size of each gram)** — how many words or characters make up one n-gram, from 1 to 100 (default 2, meaning bigrams). If `n` is larger than the number of available units, no n-grams fit and the result is empty rather than an error.
- **unit** — `words` (default) or `characters`.
- **top n (0 = all)** — how many rows to display, most frequent first (default 20; `0` shows every n-gram).
- **ignore case** — folds the text to lowercase before building n-grams (default on).
- **format** — `table` (default) or `json` (an object with `n`, `unit`, `totalNgrams`, `uniqueNgrams`, and an `ngrams` array).

```example
title: n larger than the available units produces an empty result
params: {"n": 5, "unit": "characters"}
input: ab
output:
```

```example
title: turning ignore case off keeps different cases separate
params: {"n": 1, "ignoreCase": false}
input: Ab ab
output: Ab  1
ab  1
```

## Common uses

- Finding common phrases or collocations in a body of text — the word pairs or triples that occur together most often.
- Building or inspecting the input to a simple language model or autocomplete feature.
- Character n-grams for fuzzy matching, spell-check candidate generation, or detecting repeated patterns in identifiers and codes.
- Comparing the "style fingerprint" of two texts by their most common n-grams.

## Tips and pitfalls

- Setting `n` to `1` is equivalent to plain word or character frequency counting — for words specifically, [word_frequency](/util/word_frequency/) offers the same result plus stop-word removal and a minimum length filter.
- N-grams overlap: with `n` set to 2, the characters `aaaa` count `aa` three times (starting at each of the first three positions), not twice.
- Character n-grams are built from whole code points, so an astral character such as 😀 is never split into surrogate halves. Emoji made of several code points (flags, skin tones, ZWJ sequences) and letters with a separate combining accent are split into their parts, though.
- Word n-grams ignore punctuation, so they run straight across sentence boundaries: `cat. The dog` yields the bigram `cat the` (with ignore case on).
- Like [word_frequency](/util/word_frequency/), only the top 20 rows are shown by default — set **top n** to `0` to see the complete list, which can be large for long text at higher values of `n`.
