---
title: CSV to HTML Table Converter Online
description: Turn CSV or TSV data into a clean HTML table with thead and tbody, a custom class name, and adjustable indentation.
---
## What does converting CSV to HTML do?

An HTML `<table>` is still the simplest way to publish tabular data on a web
page, in an email, or inside a CMS that accepts raw markup. This tool turns
CSV (or TSV, or pipe/semicolon-delimited data) into a `<table>` with a
`<thead>` for the header row and a `<tbody>` for the rest, escaping every
cell so special characters render as text instead of being interpreted as
markup.

## How it works

1. The delimiter is detected automatically, or set explicitly with the
   **delimiter** option.
2. The CSV is parsed with an RFC 4180 reader: quoted fields, `""` escapes,
   and embedded delimiters or newlines inside quotes are handled correctly.
3. If **first row is header** is on (the default), row one becomes a
   `<thead>` row of `<th>` cells and the rest become `<tbody>` rows of
   `<td>` cells; if it is off, every row is a `<td>` row.
4. Every cell is HTML-escaped (`&`, `<`, `>`, `"`, `'`), and an embedded
   newline inside a quoted field becomes a `<br>` so it still renders as a
   line break instead of collapsing into a space.
5. Rows shorter than the widest row are padded with empty cells, so every
   `<tr>` has the same number of columns.

```example
title: CSV to an HTML table
input:
name,email,age
Ada Lovelace,ada@example.com,36
Grace Hopper,grace@example.com,85
output:
<table>
  <thead>
    <tr>
      <th>name</th>
      <th>email</th>
      <th>age</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Ada Lovelace</td>
      <td>ada@example.com</td>
      <td>36</td>
    </tr>
    <tr>
      <td>Grace Hopper</td>
      <td>grace@example.com</td>
      <td>85</td>
    </tr>
  </tbody>
</table>
```

Turning the header off skips the `<thead>` entirely and puts every row in
`<tbody>`:

```example
title: no header row
params: {"header": false}
input: 1,2
output:
<table>
  <tbody>
    <tr>
      <td>1</td>
      <td>2</td>
    </tr>
  </tbody>
</table>
```

Setting **indent** to `0` removes the indentation, which is useful when you
want to paste the markup somewhere that will reformat it anyway:

```example
title: no indentation
params: {"indent": 0}
input: a
1
output:
<table>
<thead>
<tr>
<th>a</th>
</tr>
</thead>
<tbody>
<tr>
<td>1</td>
</tr>
</tbody>
</table>
```

A row with fewer cells than the widest row is padded with empty `<td>`
cells rather than throwing, so ragged CSV still produces a rectangular
table:

```example
title: a short row is padded to match the widest row
input:
a,b,c
1
output:
<table>
  <thead>
    <tr>
      <th>a</th>
      <th>b</th>
      <th>c</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>1</td>
      <td></td>
      <td></td>
    </tr>
  </tbody>
</table>
```

## Options

- **delimiter** — `auto` (default) detects comma, tab, semicolon, or pipe;
  or set one explicitly, including `\t` for tab.
- **first row is header** — on (default) renders row one as `<thead>`; off
  puts every row in `<tbody>`.
- **table class** — an optional CSS class added to the `<table>` tag, for
  example `table table-striped` for Bootstrap.
- **indent** — spaces per nesting level, from 0 to 16 (default 2).

## Common uses

- Publishing a small data table in a blog post, wiki page, or email body
  without a spreadsheet plugin.
- Turning a CSV export into markup for a static site generator or CMS field
  that accepts raw HTML.
- Previewing what a CSV file looks like as a table before writing real
  front-end code around it.

## Tips and pitfalls

- The output has no visual styling — it is plain semantic markup, and
  browsers draw tables without borders by default. Add CSS through the
  **table class** option and your own stylesheet.
- To go the other direction — pull a table back out of HTML — use
  [html table to csv](/util/html_table_to_csv/), which understands the same
  `<br>` convention, so embedded line breaks survive the round trip (runs
  of spaces and leading or trailing whitespace in a cell are collapsed).
- For a lighter-weight table format meant for plain text or markdown
  documents, use [csv to markdown table](/util/csv_to_markdown/) instead.
- If later rows have more columns than the header, the header row is
  padded with empty `<th>` cells like any other short row — add the extra
  header names to your CSV yourself so every column has a label.
- Blank lines are not skipped: a blank line in the middle of the CSV
  becomes a row of empty cells.
