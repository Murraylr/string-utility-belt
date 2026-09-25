---
title: Grep Lines Online — Search Text by Pattern
description: Filter text online to just the lines matching a substring or regex, with invert, whole word, context lines and line numbers, like grep.
---
## What does this grep tool do?

`grep` is the classic Unix command for keeping only the lines of a text that match a pattern. This tool does the same job in the browser: give it a substring or a regular expression, and it returns just the matching lines (or, with **invert match**, just the non-matching ones), optionally with the surrounding context lines and grep-style line-number prefixes.

## How it works

By default the **pattern** is matched as a plain substring, case-sensitively, anywhere in the line:

```example
title: keep lines containing a substring
params: {"pattern": "an"}
input: apple
banana
cherry
date
output: banana
```

Turning on **regular expression** lets the pattern use JavaScript regex syntax — not POSIX or PCRE, and compiled without the `u` flag, so `\p{…}` Unicode property escapes are not available. Each line is tested on its own, so `^` and `$` anchor to the line. In the example below, **line numbers** also prefixes each kept line with its 1-based position, using a colon for an actual match:

```example
title: match a regex and show line numbers
params: {"pattern": "^foo", "regex": true, "lineNumbers": true}
input:
foo
bar
foobar
baz
output:
1:foo
3:foobar
```

**Context lines** brings in a number of lines before and after each match, the same way `grep -C` does, and inserts a `--` separator between context groups that are not adjacent to each other:

```example
title: show one line of context around each match
params: {"pattern": "MATCH", "context": 1}
input:
a
b
MATCH
c
d
output:
b
MATCH
c
```

**Invert match** keeps exactly the lines that do *not* match, which is useful for filtering noise out of a log rather than filtering signal in:

```example
title: invert to drop the matching lines instead
params: {"pattern": "INFO", "invert": true}
input:
INFO start
WARN disk low
error: boom
INFO done
output:
WARN disk low
error: boom
```

**Whole word** restricts a match to cases where the pattern is not glued to other word characters on either side, so it distinguishes a standalone word from the same text appearing inside a longer one:

```example
title: whole word avoids matching inside a longer word
params: {"pattern": "cat", "wholeWord": true}
input:
cat
concatenate
the cat sat
output:
cat
the cat sat
```

A blank **pattern** matches every line, the same as `grep ''` does — handy as a starting point before you fill in a real pattern.

## Options

- **pattern (blank = match every line)** — the substring or regular expression to search for.
- **regular expression** — treat **pattern** as a JavaScript regex instead of a literal substring. Default off.
- **invert match** — keep the lines that do *not* match instead of the ones that do. Default off.
- **ignore case** — case-insensitive matching. Default off.
- **whole word** — require the match to sit on a word boundary rather than inside a larger run of word characters, where word characters are Unicode letters, digits and `_` (so `café` is not found inside `cafés`). Default off.
- **context lines** — how many lines of surrounding context to include around each match, from 0 to 1000. Default `0`.
- **line numbers** — prefix each kept line with its original 1-based line number, using `:` for a matched line and `-` for a context-only line.

## Common uses

- Filtering a log file down to error or warning lines.
- Isolating lines that mention a specific identifier, path or value in a large text dump.
- Reviewing a diff or config file with a few lines of surrounding context per match, the way `grep -C` does on the command line.
- Removing noisy or irrelevant lines from text before further processing, using invert match.

## Tips and pitfalls

- Context lines are gathered around the lines that survive **invert match**, not around the original matches — inverting first and then adding context shows you what surrounds the *kept* lines.
- Each line keeps its own original line ending (LF or CRLF), so a file with mixed endings is not silently normalized to one style; the output only ends in a newline if the input did.
- An invalid regular expression (unbalanced brackets, for example) throws an error rather than matching nothing.
- To also rewrite the matched text instead of just keeping or dropping whole lines, use [find and replace](/util/replace/) or [sed script](/util/sed/).
- To filter lines by their length rather than their content, use [filter lines by length](/util/filter_lines_by_length/); to keep just the first or last few lines regardless of content, use [head](/util/head/) or [tail](/util/tail/).
