---
title: Excel Column to SQL IN Clause: Quoted, Deduped, Escaped
description: Paste a column from Excel or Google Sheets and get a valid SQL IN (...) list with values trimmed, duplicates removed and apostrophes escaped.
---

## Why a quick find-and-replace is not enough

Turning a column of values into `IN ('a', 'b', 'c')` looks like a job for one find-and-replace, and for a clean list of ten numbers it is. Real columns are messier. Cells copied from Excel arrive with a trailing space here and a tab there, and on Windows every line ends in a carriage return as well as a newline. Exports repeat the same customer three times. And sooner or later a value contains an apostrophe: the first `O'Connor` in an unescaped list ends the string early, and the query either fails with a syntax error or, worse, runs as something you did not write.

Each of those problems needs its own step, and the order matters. Trimming has to happen before deduplication, or `dana@example.com` and `dana@example.com ` count as two different values. Escaping has to happen before quoting, or the quotes the recipe adds would be doubled too. Blank cells have to be skipped rather than turned into an empty `''` entry that silently matches rows with an empty column.

## What each step does to your data

The [trim each line](/util/trim_lines/) step removes leading and trailing whitespace from every cell, tabs and non-breaking spaces included. Every step splits lines on Windows (CRLF) and Unix line endings alike, so a column copied on Windows works the same way. [Deduplicate lines](/util/line_dedupe/) keeps the first occurrence of each value and drops later repeats. It compares exactly, so `SKU-abc` and `SKU-ABC` both stay: on a case-sensitive collation (PostgreSQL by default) they are different keys, and merging them would quietly drop rows from your result.

[SQL escape](/util/sql_escape/) doubles each single quote, the standard SQL way to put an apostrophe inside a string literal. Then [prefix / suffix lines](/util/line_affix/) runs twice: once to quote each value and join them with commas, once to wrap the whole list in `IN (` and `)`. Change the second one's prefix to `WHERE email IN (` and the output becomes a complete clause.

## Things to check before you run the query

The escape step uses the standard SQL rule, which is right for PostgreSQL, SQL Server, Oracle and SQLite. MySQL and MariaDB also treat a backslash inside a string as an escape character by default, so there a value ending in a backslash (`C:\Temp\`) swallows its closing quote and breaks the list, and a crafted value can end the list early. Snowflake reads backslashes the same way. For those databases, add a [replace](/util/replace/) step before the escape step that turns every `\` into `\\` with regex off: they read a doubled backslash as one and accept the doubled apostrophes too. (MySQL with the NO_BACKSLASH_ESCAPES mode on needs neither.) Don't switch the escape step to its `mysql` flavor for this: that flavor also escapes line breaks, which merges the whole column into a single value. If the values come from other people rather than your own spreadsheet, do not paste them into SQL at all; pass them as query parameters or load them into a temporary table.

If you copied the header cell along with the column, it ends up in the list as a value: delete the first line of the input, or deselect the header before copying. Numeric IDs come out quoted. Most databases cast `'42'` to a number when comparing it with an integer column, but if yours does not, clear the quote step's prefix and suffix.

Very long lists have limits. Oracle accepts at most 1,000 expressions in one `IN` list, and every database slows down as the list grows into the thousands. For lists that size, load the values into a temporary table and join against it, or pass them as an array parameter (`= ANY($1)` in PostgreSQL). For a quick one-off query from a spreadsheet, though, this recipe gives you a list that is correct the first time.

## Doing it inside the spreadsheet instead

Excel 365 and Excel 2021 can build a similar list with a formula: `="IN ('" & TEXTJOIN("', '", TRUE, UNIQUE(TRIM(A2:A500))) & "')"`. It is not quite the same. UNIQUE ignores case, so `SKU-abc` and `SKU-ABC` become one value. TRIM removes only ordinary spaces, leaving tabs and non-breaking spaces in place, and it also collapses a double space inside a value, so `Acme  Corp` stops matching. Apostrophes still need wrapping the range in `SUBSTITUTE(…, "'", "''")`. The recipe's steps avoid those differences, can be seen and changed one by one, and nothing you paste leaves your browser.
