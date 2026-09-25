---
title: Change Case Online — Upper, Lower, Title & Sentence Case
description: Convert text to UPPERCASE, lowercase, Title Case, or Sentence case online. A simple case converter with clear rules and worked examples for each mode.
---
## What is case conversion?

Case conversion changes the capitalization of letters without changing what the letters are. It is one of the most common small text edits there is: fixing text pasted from a source that used the wrong case, preparing a heading, or normalizing user input before comparing or storing it. This tool offers four modes — uppercase, lowercase, title case, and sentence case — each with a simple, predictable rule.

## How it works

Each mode applies one rule to the whole input:

- **upper** uppercases every letter and leaves everything else — digits, punctuation, spacing — untouched.
- **lower** lowercases every letter the same way.
- **title** capitalizes the first letter of every word and lowercases the rest of that word, where a "word" is a run of non-space characters starting with an ASCII letter, digit, or underscore. Hyphenated words count as one word (`hello-world` becomes `Hello-world`), and mixed-case words are flattened (`iPhone` becomes `Iphone`).
- **sentence** lowercases everything, then capitalizes the first letter of each sentence: the first letter of the input (skipping any leading spaces, quotes or digits) and the first letter after every `.`, `!` or `?` that is followed by a space or a line break.

```example
title: uppercase
params: {"mode": "upper"}
input: hello world
output: HELLO WORLD
```

```example
title: lowercase
params: {"mode": "lower"}
input: Hello WORLD
output: hello world
```

```example
title: title case
params: {"mode": "title"}
input: hello world
output: Hello World
```

Each sentence gets its own capital, and every other letter is lowercased:

```example
title: sentence case capitalizes each sentence
params: {"mode": "sentence"}
input: HELLO WORLD. this is FINE!
output: Hello world. This is fine!
```

A leading quote or digit is skipped, so the first actual letter is the one capitalized:

```example
title: the first letter after a leading digit is capitalized
params: {"mode": "sentence"}
input: 3 APPLES. two pears
output: 3 Apples. Two pears
```

Empty input is returned unchanged for every mode:

```example
title: empty input in any mode
params: {"mode": "title"}
input:
output:
```

## Options

- **mode** (`mode`, default `upper`) — one of `upper`, `lower`, `title`, or `sentence`, as described above. There is no option to preserve existing capitalization selectively; each mode rewrites the whole string.

## Common uses

- Normalizing form input, usernames, or search queries before comparing or storing them.
- Formatting a heading or label as Title Case for a UI or document.
- Cleaning up text that was typed in the wrong case, such as `AN ACCIDENTAL CAPS LOCK MESSAGE`.
- Turning all-caps or all-lowercase text — shouted headings, old database exports — back into normal sentences.

## Tips and pitfalls

- **Sentence case knows punctuation, not grammar.** A sentence starts after `.`, `!` or `?` plus whitespace, so abbreviations start one too (`e.g. this` becomes `E.g. This`), while a line break without punctuation does not. Names and acronyms are lowercased like every other word (`i love Paris` becomes `I love paris`), so check proper nouns afterwards.
- **Title case ignores style-guide rules.** It does not skip small words like "a" or "the" the way a professional style guide would — every word gets its first letter capitalized.
- **Title case only recognizes ASCII word starts.** A word that begins with an accented or non-Latin letter is matched from its first ASCII letter instead, so `élan` becomes `éLan`. Use `upper` or `lower` for non-English text.
- If you need code-identifier casing such as `camelCase` or `snake_case` instead of prose casing, use [format case](/util/format_case/).
- To invert existing capitalization letter by letter instead of applying one rule, see [swap case](/util/swap_case/); for a random mix, see [random case](/util/random_case/).
- To turn text into a URL-safe identifier rather than just changing letter case, use [slug](/util/slug/).
