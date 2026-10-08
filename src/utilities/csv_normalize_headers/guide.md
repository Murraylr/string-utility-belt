---
title: CSV Header Case Converter — snake_case & camelCase
description: Rewrite CSV header rows to snake_case, camelCase, kebab-case, PascalCase, or Title Case online, with automatic de-duplication.
---
## What does normalizing CSV headers do?

Spreadsheet exports usually have human-readable headers like `First Name` or
`E-Mail`, but code that consumes the CSV — a database import, a JSON schema,
an API client — almost always wants a consistent identifier style instead:
`first_name`, `firstName`, and so on. This tool rewrites only the header row
to the case style you choose; data values are left untouched (rows are
re-written with quotes only where a field needs them).

## How it works

1. Each header cell is split into words on case boundaries (`UserID` →
   `User`, `ID`) and on any run of non-letters/non-digits (spaces, hyphens,
   underscores), so `Last  Name` and `last-name` both become the same two
   words.
2. The words are rejoined in the chosen **style**.
3. If **de-duplicate names** is on (the default), a repeated result gets a
   numeric suffix so no two columns end up with the same name.
4. A header cell that has no letters or digits at all — blank, or symbols
   only — falls back to `column_<n>` before styling, so every column still
   gets a usable name. (`lower` and `upper` keep symbols, so for them only a
   blank cell falls back.)

```example
title: title case to snake_case (the default style)
input:
First Name,Last Name
Ada,Lovelace
output:
first_name,last_name
Ada,Lovelace
```

Styling and de-duplication happen together: two headers that only differ in
spacing or case would otherwise collide.

```example
title: camelCase with automatic de-duplication
params: {"style": "camel"}
input:
user id,User ID
1,2
output:
userId,userId2
1,2
```

Turning de-duplication off keeps the styled names even when that means two
columns share a name — useful when you plan to rename them by hand
afterwards:

```example
title: de-duplication off keeps repeated names as-is
params: {"style": "snake", "dedupe": false}
input:
a,a,A
1,2,3
output:
a,a,a
1,2,3
```

A header cell with nothing to style falls back to its position:

```example
title: an empty header cell is named after its column
params: {"style": "snake"}
input:
a,,c
1,2,3
output:
a,column_2,c
1,2,3
```

Blank lines between rows are dropped from a table with two or more columns,
where they cannot be a record. In a one-column table a blank line is a
record whose value is empty, so it is kept and written as `""` — the form
that readers which skip blank lines, such as
[csv to json](/util/csv_to_json/), still count as a row:

```example
title: an empty value in a one-column table is kept
input:
Email Address
a@example.com

b@example.com
output:
email_address
a@example.com
""
b@example.com
```

## Options

- **style** — `snake` (default, `first_name`), `camel` (`firstName`),
  `pascal` (`FirstName`), `kebab` (`first-name`), `title` (`First Name`),
  `lower` (lower-cased, spacing untouched), or `upper` (upper-cased, spacing
  untouched). Note that `lower` and `upper` do not re-split words the way
  the other styles do — they only change letter case.
- **delimiter** — `auto` (default) detects comma, tab, semicolon, or pipe;
  or set one explicitly.
- **de-duplicate names** — on by default, appending `_2`, `2`, `-2`, or a
  space and `2` (matching the style) to any header that would otherwise
  repeat.

## Common uses

- Preparing a CSV export for [csv to json](/util/csv_to_json/) so the
  resulting object keys are valid, predictable identifiers.
- Matching a database's column-naming convention (`snake_case` is common
  in SQL schemas) before generating [csv to sql insert](/util/csv_to_sql/)
  statements.
- Cleaning up headers copied from a spreadsheet before using
  [csv select columns](/util/csv_columns/) to pick specific fields by name.

## Tips and pitfalls

- Non-ASCII letters are preserved and cased correctly (`Prénom` → `prénom`),
  but only Unicode letters and digits count as "word" characters. Anything
  else is a separator — including the combining accent marks of decomposed
  (NFD) text, so a decomposed `Prénom` becomes `pre_nom` in `snake` style.
- `lower` and `upper` are the two styles that do not merge multi-word
  headers into one token; use `snake` or `camel` if you also want the
  spacing normalized.
- Because normalization only touches row one, you can usually run it before
  or after [csv select columns](/util/csv_columns/), as long as your column
  list matches whichever headers are current at that step. The exceptions
  are de-duplication suffixes and `column_<n>` fallback names, which depend
  on which columns are present and where they sit.
