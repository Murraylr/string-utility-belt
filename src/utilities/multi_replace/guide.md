---
title: Multi Replace Online — Apply Many Find/Replace Rules
description: Run a whole list of find-and-replace rules against text in one step online, with optional regex patterns, case-insensitive matching, and cascading control.
---
## What does this tool do?

Multi replace applies a list of find/replace rules to text at once, instead of running a separate find-and-replace step for each pair. Each rule is a "find" pattern and a "replace" value; the tool walks the list and applies every rule to the text.

```example
title: apply several rules in one step
params: {"rules": [["colour", "color"], ["grey", "gray"]]}
input: the colour grey
output: the color gray
```

## Writing rules

Rules are entered as a list of find/replace pairs in the rules editor. A row with an empty find field is skipped, so a blank row you haven't filled in yet does not cause an error. Leaving a rule's replace value empty deletes every match of its find pattern instead of replacing it:

```example
title: a rule with an empty replacement deletes the match
params: {"rules": [["REMOVE", ""]]}
input: aREMOVEb
output: ab
```

Find and replace values are used exactly as typed: spaces around them are kept, and backslash sequences such as `\n` are not turned into special characters (with **find is a regex** on, the regex engine still reads them in the find pattern, but never in the replacement). To match or insert a line break, press Shift+Enter inside a cell. From the `subelt` CLI, pass the pairs as JSON or as a comma list such as `rules=colour:color,grey:gray`.

Pipelines saved by older versions, which kept all the rules in one block of text, still run and give the same result; the rules editor shows that text read-only and offers a one-click conversion to pairs.

By default, rules run in order and **cascade**: each rule is applied to the whole output of the rules before it, so a later rule also sees, and can change, text that an earlier rule just inserted.

```example
title: rules cascade by default
params: {"rules": [["a", "b"], ["b", "a"]]}
input: ab
output: aa
```

Turning on **apply once** instead makes a single left-to-right pass over the original text: at each position, the first rule that matches wins, and its replacement is emitted without being re-scanned by any other rule.

```example
title: apply once stops rules from cascading
params: {"rules": [["a", "b"], ["b", "a"]], "applyOnce": true}
input: ab
output: ba
```

## Regex rules

Turning on **find is a regex** treats every find pattern as a regular expression instead of literal text, so you can use character classes, quantifiers, and capture groups. Captured groups are available in the replacement as `$1`, `$2`, and so on, `$&` stands for the whole match, and `$$` produces a literal `$`.

```example
title: swap two captured groups
params: {"rules": [["(\\w+)@(\\w+)", "$2:$1"]], "regex": true}
input: user@host
output: host:user
```

## Options

- **rules (find / replace)** — the list of find/replace pairs, applied in order. A row with an empty find field is skipped rather than treated as an error.
- **find is a regex** — interprets each find pattern as a regular expression (default off, meaning literal text).
- **ignore case** — matches without regard to letter case, for both literal and regex rules (default off).
- **apply once (rules do not cascade)** — makes one non-overlapping left-to-right pass instead of applying each rule to the whole text in turn (default off).

## Common uses

- Bulk terminology or spelling replacements — British to American spelling, renaming a product, or standardizing abbreviations — in a single pass.
- Building a lightweight lookup table: mapping a set of codes, tokens, or placeholders to their final values.
- Cleaning up exported data with several known substitutions (quote styles, escaped characters, delimiters) at once.
- Regex-based extraction-and-reshaping, such as swapping the order of a user and host in an address, using capture groups.

## Tips and pitfalls

- Cascading is powerful but can surprise you: swapping `a` for `b` and `b` for `a` in the same list does not swap them, because the second rule sees the first rule's own output. Use **apply once** whenever you want the rules to describe simultaneous substitutions rather than sequential ones.
- Astral characters (most emoji) are treated as whole units by literal (non-regex) rules, so a rule like `😀` never matches only half of it.
- Regex rules always replace every match; there is no flags field, and the only flag you can add is case-insensitivity through **ignore case**. Write the pattern without slashes (`\d+`, not `/\d+/g`).
- A malformed regex rule makes the step fail with an error that gives the rule's row number (reported as a "line"), so you can fix it directly instead of guessing which rule failed.
- For simpler single-pattern extraction rather than replacement, see [regex_extract](/util/regex_extract/); for a single pair of find and replace text, the plain [replace](/util/replace/) utility is more direct.
