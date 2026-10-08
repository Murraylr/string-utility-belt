---
title: Split and Join Text Online: Swap Delimiters Fast
description: Split text on one delimiter and rejoin it with another online, to convert commas to pipes, spaces to dashes, and more.
---
## What does split and join do?

Split and join is a two-step operation done in one pass: first the input is cut apart everywhere a chosen delimiter occurs, then the pieces are glued back together with a different delimiter. It is the simplest way to convert one separated format into another: turning a comma-separated list into a pipe-separated one, collapsing multiple lines into a single space-separated line, or spreading a sentence out one word per line.

## How it works

The **split by** value is matched literally, not as a regular expression, so characters like `.` or `*` in it are treated as plain text rather than pattern syntax. Every occurrence of that exact string becomes a cut point, and the pieces between the cuts are then rejoined with the **join with** value.

```example
title: commas to pipes
params: {"splitBy": ",", "joinWith": " | "}
input: a,b,c
output: a | b | c
```

If the delimiter you are splitting on never occurs in the input, nothing is cut, and the whole string is returned unchanged by the join step (there is only one piece to "join").

```example
title: no delimiter found means no change
params: {"splitBy": ",", "joinWith": "-"}
input: hello
output: hello
```

An empty **split by** value splits between every character, one piece per character. That is the same as JavaScript's `"abc".split("")`, which means one piece per UTF-16 code unit, so an emoji or other character outside the Basic Multilingual Plane is broken into two invalid halves. Joining those single-character pieces back together with a delimiter effectively inserts that delimiter between every character:

```example
title: an empty split delimiter splits every character
params: {"splitBy": "", "joinWith": "-"}
input: abc
output: a-b-c
```

An empty **join with** value glues every piece back together with nothing between them, which removes the delimiter entirely:

```example
title: an empty join delimiter removes the separator
params: {"splitBy": ",", "joinWith": ""}
input: a,b,c
output: abc
```

## Options

- **split by**: the literal string to cut the input on. Defaults to a comma. Leave it empty to split into individual characters.
- **join with**: the literal string placed between the pieces when rejoining. Defaults to a newline, which is what turns a delimited list into one item per line.

Both fields are taken literally: typing `\n` or `\t` means a backslash followed by a letter, not a newline or tab.

## Common uses

- Converting a comma-separated value list into one entry per line. The default settings do exactly that.
- Swapping a simple delimiter, for example changing a pipe-delimited list to semicolons. For real CSV, where fields can be quoted and contain the delimiter, use [csv change delimiter](/util/csv_delimiter/), which re-quotes fields correctly.
- Spreading a sentence out one word per line by splitting on a space and keeping the default newline join.
- Removing a delimiter altogether by joining with an empty string.

## Tips and pitfalls

- Because the delimiter is matched literally, you cannot split on "any whitespace" or "one or more commas" here. For that kind of pattern-based splitting, use [sed script](/util/sed/) or [find and replace](/util/replace/) with a regular expression, or run [collapse whitespace](/util/collapse_whitespace/) first to normalize runs of spaces into one.
- Splitting and joining with the *same* delimiter is a no-op that returns the input unchanged.
- To add a prefix or suffix to each resulting item instead of just changing the delimiter, use [prefix / suffix lines](/util/line_affix/), which also has a "join with" option for building a one-line list like a SQL `IN (...)` clause. It is also the easier way to collapse lines into one comma-separated line, since this tool's single-line **split by** box cannot hold a newline.
- To flip the order of the pieces after splitting rather than just rejoining them, use [reverse word order](/util/reverse_words/), which supports the same idea of a custom separator.
