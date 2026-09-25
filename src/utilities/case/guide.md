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
- **sentence** uppercases only the very first character of the whole input and lowercases everything after it, regardless of how many sentences or line breaks follow. If the input starts with a space, quote or digit, nothing ends up capitalized.

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

Sentence case only touches the first character — it does not detect sentence boundaries, so a multi-sentence string still gets a single capital at the very start and everything else is lowercased:

```example
title: sentence case only capitalizes the first letter
params: {"mode": "sentence"}
input: HELLO WORLD
output: Hello world
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
- Producing a single capitalized lead-in for a sentence pulled from all-caps or all-lowercase source data.

## Tips and pitfalls

- **Sentence case is not sentence-aware.** If your text has several sentences, only the first character of the whole string is capitalized; letters after periods elsewhere in the text are lowercased along with everything else. If you want the rest of the text left as it is rather than lowercased, the `sentence` mode of [format case](/util/format_case/) trims surrounding whitespace, uppercases the first remaining character and leaves everything else as it is.
- **Title case ignores style-guide rules.** It does not skip small words like "a" or "the" the way a professional style guide would — every word gets its first letter capitalized.
- **Title case only recognizes ASCII word starts.** A word that begins with an accented or non-Latin letter is matched from its first ASCII letter instead, so `élan` becomes `éLan`. Use `upper` or `lower` for non-English text.
- If you need code-identifier casing such as `camelCase` or `snake_case` instead of prose casing, use [format case](/util/format_case/).
- To invert existing capitalization letter by letter instead of applying one rule, see [swap case](/util/swap_case/); for a random mix, see [random case](/util/random_case/).
- To turn text into a URL-safe identifier rather than just changing letter case, use [slug](/util/slug/).
