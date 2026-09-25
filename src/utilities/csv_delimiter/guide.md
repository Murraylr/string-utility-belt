---
title: CSV Delimiter Converter — Comma, Tab, Pipe & More
description: Convert CSV or TSV between comma, tab, pipe, and semicolon delimiters online, with automatic re-quoting and source detection.
---
## What is a CSV delimiter?

CSV ("comma-separated values") is really a family of formats: the character
that separates fields varies between comma, tab (often called TSV), pipe,
and semicolon depending on the tool that produced the file. A file exported
by one system will not always import cleanly into another that expects a
different delimiter. This tool re-delimits the table, and — unlike a plain
find-and-replace — it re-quotes every field correctly for the new
separator, so a field that used to be safely unquoted can gain quotes if the
new delimiter appears inside it, and a field that no longer needs quoting
loses them.

## How it works

1. The source delimiter is detected automatically (**from delimiter**:
   `auto`) by parsing the text against comma, tab, semicolon, and pipe and
   picking whichever produces the widest, most consistent set of rows. You
   can also name it explicitly.
2. The text is parsed as RFC 4180 CSV: quoted fields, `""` escapes, and
   embedded newlines and delimiters inside quotes are all preserved as data.
3. Every field is re-emitted with the **to delimiter**, wrapped in quotes
   only when it actually needs them for the new character — when it
   contains a quote, a newline, or the new delimiter itself.

```example
title: comma to semicolon
params: {"from": "auto", "to": ";", "quoteAll": false}
input:
name,email,age
Ada Lovelace,ada@example.com,36
Grace Hopper,grace@example.com,85
output:
name;email;age
Ada Lovelace;ada@example.com;36
Grace Hopper;grace@example.com;85
```

Escaped `""` quotes inside a field are just data, and survive a delimiter
change intact:

```example
title: an escaped quote survives the delimiter change
params: {"to": ";"}
input:
a,b
"say ""hi""",2
output:
a;b
"say ""hi""";2
```

Setting **quote every field** on wraps every value regardless of whether it
needs it, which some strict CSV importers expect:

```example
title: quote every field
params: {"to": ";", "quoteAll": true}
input:
a,b
1,2
output:
"a";"b"
"1";"2"
```

A quoted empty field (`""`) is data — a deliberately empty value — and stays
distinguishable from a genuinely blank line, which the converter drops:

```example
title: a quoted empty field survives, a blank line does not
params: {"to": ";"}
input:
a
""
z
output:
a
""
z
```

## Options

- **from delimiter** — `auto` (default) detects the source delimiter; or set
  it explicitly, including delimiter names (`tab`, `comma`, `semicolon`,
  `pipe`, `space`, `colon`) and escapes such as `\t`.
- **to delimiter** — the output delimiter, defaulting to `\t` (tab); left
  empty, it also falls back to tab. It accepts the same names and escapes,
  and cannot be the quote character (`"`) or a line break.
- **quote every field** — off by default (quote only what needs it); on
  wraps every field in quotes.

## Common uses

- Turning a comma-separated export into a tab-separated file for tools that
  expect TSV, or the reverse.
- Preparing CSV for import into systems that use semicolons because commas
  are the decimal separator in their locale.
- Normalizing pipe-delimited log exports into standard CSV before feeding
  them to [csv to json](/util/csv_to_json/) or [csv select columns](/util/csv_columns/).

## Tips and pitfalls

- Converting to another delimiter and back gives you the same fields and
  the same line-ending style, but not always a byte-identical file: quotes
  that were not needed are dropped, blank lines are removed, and a trailing
  newline is not kept.
- The output always uses one line-ending style: CRLF if the source's row
  separators (outside quoted fields) were at least as often CRLF as LF,
  otherwise LF.
- If rows come out with fewer fields than expected — often a whole row as
  one field — the source was parsed with the wrong **from delimiter**; a
  wrong source delimiter merges fields instead of raising an error. Auto-detection only considers comma, tab,
  semicolon, and pipe (judged on the first 20 rows), so name any other
  source delimiter explicitly.
