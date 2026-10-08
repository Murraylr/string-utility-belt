---
title: SQL Minifier Online: Collapse SQL to One Line
description: Minify SQL online by collapsing whitespace onto one line and stripping -- and /* */ comments, while leaving string literals untouched.
---
## What is SQL minification?

A pretty-printed SQL query spread across many lines is easy to read but bulky to store, log, or embed in a single-line config value or shell command. This tool collapses a SQL query onto one line. It squeezes each run of whitespace down to a single space and can remove comments, while being careful never to touch the contents of a string literal or quoted identifier, including a comment marker that only looks like one inside a string.

## How it works

Runs of whitespace between tokens collapse to a single space, and both `--` line comments and `/* */` block comments are stripped by default:

```example
title: strip comments and collapse
input: SELECT a, b
FROM t -- comment
WHERE a = 1;
output: SELECT a, b FROM t WHERE a = 1;
```

Spacing is also tightened around commas, semicolons and parentheses, since a space before `,`, `;` or `)` and after `(` is never meaningful. Other single spaces, such as those around `=`, are kept:

```example
title: tightens spacing around commas and parentheses
input: insert into t ( a , b ) values ( 1 , 2 )
output: insert into t (a, b) values (1, 2)
```

The minifier tracks quoted strings, quoted identifiers (backtick, double-quote, and T-SQL `[bracket]` identifiers), and Postgres dollar-quoted bodies (`$$ ... $$`) as it scans, so anything that merely looks like a comment marker or extra whitespace inside one of those is left completely untouched:

```example
title: comment markers inside string literals are never touched
input: select 'a -- b' , '/* c */' from t
output: select 'a -- b', '/* c */' from t
```

Turning off **remove comments** keeps them, with a `--` line comment forced onto its own line (since a line comment consumes everything to the end of the line, it cannot be folded into the surrounding text):

```example
title: keeping comments forces a line break after a line comment
params: {"removeComments": false}
input: select 1 -- note
from t
output: select 1 -- note
from t
```

## Options

- **remove comments**: on by default, strips both `--` line comments and `/* */` block comments. When off, comments are preserved exactly, with only a mandatory line break after a `--` comment.
- **newline after each ;**: off by default, which packs multiple statements onto one line. When on, each `;` is followed by a line break, so a script of several statements becomes one statement per line rather than one continuous line.

## Common uses

- Shrinking a query before embedding it in a single-line environment variable, a URL parameter, or a log field.
- Normalizing whitespace differences between two versions of the same query before diffing them.
- Producing a compact query for a shell one-liner or a CI script.

## Tips and pitfalls

- Minifying is idempotent: running it again on already-minified SQL changes nothing further.
- Unterminated string literals, quoted identifiers, block comments or dollar-quoted bodies are reported with the line number where they start, rather than silently producing truncated output.
- A T-SQL bracket identifier like `[a]] b]` (where `]]` escapes a literal `]`) is recognized as a single identifier, so its internal spacing is preserved rather than being tightened.
- Quotes are escaped by doubling (`'it''s'`), the standard SQL rule. MySQL-style backslash escapes are not recognized, so `'it\'s'` is reported as an unterminated string literal.
- MySQL's `#` line comments are not recognized either. They are kept as ordinary text and folded onto the same line, which comments out everything after them, so change them to `--` first.
- To reverse this and make a query readable again, see [sql format](/util/sql_format/).
