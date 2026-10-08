---
title: Regex Explainer Online: Understand a Pattern's Parts
description: Break down any regular expression token by token in plain English, as an indented tree or as JSON, including groups, quantifiers, and flags.
---
## What does this do?

Regular expressions are dense: a handful of characters can encode a surprisingly specific rule, and coming
back to someone else's pattern (or your own, six months later) often means re-deriving what it means from
scratch. This tool parses a pattern and explains every piece of it in plain English (each literal
character, character class, group, quantifier, anchor, lookaround, and back-reference), either as an
indented tree or as structured JSON.

It reads patterns in JavaScript (ECMAScript) syntax, the flavor used by browsers and Node.js. It does not
run the pattern against any text; it only documents the pattern's structure.

## How it works

You can type a pattern directly into the **pattern** field, or leave it blank and put the pattern in the
main input instead, including as a `/pattern/flags` literal, which is understood automatically. Each part
of the pattern becomes one row, indented to show what is nested inside what:

```example
title: a pattern with two capturing groups
input: ^(\d{4})-(\d{2})$
output:
pattern:   /^(\d{4})-(\d{2})$/
flags:     (none)

^        —  the start of the string (or of a line when the m flag is set)
( … )    —  capturing group 1
  \d{4}  —  any digit (0-9), repeated exactly 4 times
-        —  the character "-"
( … )    —  capturing group 2
  \d{2}  —  any digit (0-9), repeated exactly 2 times
$        —  the end of the string (or of a line when the m flag is set)

capture groups: 1, 2
```

Named groups and alternation are explained the same way, with each alternative branch nested under a
"match any ONE of these" row. Alternation and groups can nest inside each other:

```example
title: a named group alongside a nested alternation
params: {"pattern": "(?<year>\\d{4})|(cat|dog)"}
input:
output:
pattern:   /(?<year>\d{4})|(cat|dog)/
flags:     (none)

|                 —  match any ONE of these 2 alternatives
  option 1
    (?<year> … )  —  capturing group 1, named "year"
      \d{4}       —  any digit (0-9), repeated exactly 4 times
  option 2
    ( … )         —  capturing group 2
      |           —  match any ONE of these 2 alternatives
        option 1
          cat     —  the literal text "cat"
        option 2
          dog     —  the literal text "dog"

capture groups: 1 ("year"), 2
```

Lookahead and lookbehind are named explicitly rather than left as unexplained punctuation, including
whether they are positive or negative:

```example
title: lookahead assertions
params: {"pattern": "(?=a)(?!b)"}
input:
output:
pattern:   /(?=a)(?!b)/
flags:     (none)

(?= … )  —  positive lookahead — what follows must match here, but is not consumed
  a      —  the character "a"
(?! … )  —  negative lookahead — what follows must NOT match here
  b      —  the character "b"
```

Setting **output** to `json` returns the same breakdown as structured data. Each node carries its `type`,
the exact source text it came from (`raw`), a plain-English `description`, and its `quantifier` when it has
one. That is convenient for feeding into another tool or for building your own explanation UI:

```example
title: json output for a quantified character
params: {"pattern": "a{2,4}", "format": "json"}
input:
output:
{
  "pattern": "a{2,4}",
  "flags": "",
  "flagDescriptions": [],
  "groupCount": 0,
  "groups": [],
  "tree": [
    {
      "type": "literal",
      "token": "a{2,4}",
      "raw": "a{2,4}",
      "description": "the character \"a\", repeated between 2 and 4 times, as many as possible (greedy)",
      "quantifier": "{2,4}"
    }
  ]
}
```

## Options

- **pattern**: the regular expression source to explain. Leave it blank to use the main input instead,
  which is also understood as a full `/pattern/flags` literal.
- **flags**: the regex flags to apply (`g`, `i`, `m`, `s`, `u`, `v`, `y`, `d`), described individually in
  the output; an unknown or repeated flag is an error. When the pattern comes from a `/pattern/flags`
  literal in the input, the literal's flags are used only if this field is blank; anything typed here
  takes precedence.
- **output**: `tree` (default, the indented plain-English breakdown shown above) or `json` (structured
  data with the same information).

## Common uses

- Understanding a regular expression you inherited, found in Stack Overflow, or wrote a while ago and no
  longer remember the details of.
- Documenting a validation pattern used in code review, in a pull request description, or in a runbook.
- Teaching or learning regex syntax by seeing a pattern's pieces named and explained one at a time.
- Sanity-checking a pattern's structure (number of capture groups, which quantifiers are greedy versus
  lazy) before pasting it into [regex extract](/util/regex_extract/) or another tool that uses it.

## Tips and pitfalls

- This tool explains structure, it does not test matches. To see what a pattern actually captures in real
  text, use [regex extract](/util/regex_extract/) instead.
- A malformed pattern (an unmatched `(`, `[`, or `)`, a dangling backslash, or a quantifier with the
  maximum below the minimum (like `{4,2}`)) produces a clear error message rather than a partial
  explanation, so you know exactly what to fix.
- Back-references (`\1`, `\k<name>`) are explained by number or name but are not checked for whether that
  group actually exists elsewhere in the pattern.
- Unicode property escapes (`\p{...}`, `\P{...}`) are explained by name but require the `u` or `v` flag to
  actually work when the pattern runs. The explanation notes this, but does not add the flag for you or
  check that the property name exists.
- It is an explainer, not a validator for the JavaScript engine. A few things JavaScript would reject are
  still explained. A possessive quantifier such as `a++` is described as possessive, although JavaScript
  has no possessive quantifiers and throws "Nothing to repeat". The `v` flag's set operations (nested
  classes, `--`, `&&`) are not parsed, so such classes are explained incorrectly.
- Syntax from other flavors is not recognized: PCRE's atomic groups `(?>…)` are rejected as unsupported,
  and escapes such as `\A`, `\Z` or `\h` are explained as the literal letters `A`, `Z` and `h`, which is
  what they match in JavaScript without the `u` flag (with it, they are syntax errors).
