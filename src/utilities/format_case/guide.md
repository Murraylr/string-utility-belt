---
title: camelCase, snake_case & kebab-case Converter Online
description: Convert text to camelCase, PascalCase, snake_case, or kebab-case online for identifiers and config keys, plus upper, lower, title, and sentence case.
---
## What is identifier case conversion?

Programming languages and config formats each favor a different naming convention: JavaScript variables are typically `camelCase`, classes are `PascalCase`, Python and database columns often use `snake_case`, and URLs or CSS classes use `kebab-case`. This tool converts free text or an identifier in one convention into any of the others, plus the same plain-prose upper, lower, title, and sentence modes offered by [change case](/util/case/).

## How it works

The input is first split into words. A run of anything that is not a Unicode letter or number is treated as a separator, and — unlike a simple space split — a lowercase letter or digit immediately followed by an uppercase letter is also treated as a word boundary, so an already-`camelCase` or `PascalCase` identifier is split back into its original words before being rejoined:

```example
title: camelCase (the default)
params: {"mode": "camel"}
input: hello world example
output: helloWorldExample
```

```example
title: snake_case
params: {"mode": "snake"}
input: Hello World Example
output: hello_world_example
```

```example
title: kebab-case from an existing camelCase identifier
params: {"mode": "kebab"}
input: HelloWorld
output: hello-world
```

Unicode letters are preserved rather than stripped, so accented and other non-ASCII words keep their characters instead of being dropped the way a strictly ASCII slugify would:

```example
title: accented letters survive the conversion
params: {"mode": "camel"}
input: café latte
output: caféLatte
```

The `sentence` mode is the same as [change case](/util/case/)'s: it lowercases everything, then capitalizes the first letter of each sentence — the first letter of the input and the first letter after every `.`, `!` or `?` followed by whitespace. Surrounding whitespace is kept as it is:

```example
title: sentence mode capitalizes each sentence and lowercases the rest
params: {"mode": "sentence"}
input: HELLO WORLD. this is FINE.
output: Hello world. This is fine.
```

Empty input passes straight through for every mode:

```example
title: empty input
params: {"mode": "snake"}
input:
output:
```

## Options

- **mode** (`mode`, default `camel`) — one of:
  - `camel` — `helloWorldExample`
  - `pascal` — `HelloWorldExample`
  - `snake` — `hello_world_example`
  - `kebab` — `hello-world-example`
  - `upper` / `lower` — plain `.toUpperCase()` / `.toLowerCase()` on the whole string
  - `title` — capitalizes the first letter of each word and lowercases the rest of it, using the same rule as [change case](/util/case/): a word must start with an ASCII letter, digit or underscore
  - `sentence` — lowercases everything, then capitalizes the first letter of each sentence (the start of the input, and after `.`, `!` or `?` plus whitespace)

## Common uses

- Converting a human-written title or label into a variable, function, or class name.
- Rewriting keys between naming conventions when moving data between a JSON API (`camelCase`), a database (`snake_case`), and a URL or CSS class (`kebab-case`).
- Normalizing inconsistently-cased identifiers in a codebase or config file during a refactor.

## Tips and pitfalls

- `camel`, `pascal`, `snake`, and `kebab` all use the same word-splitting logic, so they agree on what counts as a "word" — the only difference is how the words are capitalized and joined.
- Whitespace-only input under `sentence` mode is returned exactly as given, since there is no non-blank character to capitalize.
- This tool does not validate that its output is a legal identifier in any particular language (for example, a result starting with a digit is not escaped) — check the target language's rules if that matters.
- A word boundary is only detected where a lowercase letter or digit meets an uppercase letter, so a run of capitals stays glued to the next word: `parseHTTPResponse` becomes `parse_httpresponse` in `snake` mode. Insert a space or underscore after the acronym first if you need `parse_http_response`.
- A digit followed by a lowercase letter is not a boundary either: `item2go` stays one word, while `2Fast` splits into `2` and `fast`.
- To produce an ASCII-only, URL-safe slug rather than an identifier that keeps Unicode letters, use [slug](/util/slug/).
