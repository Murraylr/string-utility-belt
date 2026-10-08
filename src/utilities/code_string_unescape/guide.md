---
title: Code String Unescape: Decode Source String Literals
description: Decode a source-code string literal back to plain text, handling escape sequences and quoting rules for 10 languages.
---
## What does unescaping a string literal do?

Source code represents text as string literals: `"hello\nworld"` in JavaScript, `'it\'s'` in Python, and so on. Each language has its own escape rules: which backslash sequences mean what, whether an unknown escape keeps its backslash, whether the delimiter is doubled instead of escaped. This tool is the reverse of [code string escape](/util/code_string_escape/): give it a string literal (with or without its surrounding quotes) and a language, and it returns the plain text the literal represents.

## How it works

The tool first strips a matching pair of surrounding quotes if the input has them (double, single, or backtick), then decodes the body according to the chosen language's rules.

```example
title: escape sequences
input: "hello\nworld\t!"
output:
hello
world	!
```

Surrounding quotes are optional. An unquoted body is decoded the same way:

```example
title: an unquoted body
input: it\'s a \"test\"
output: it's a "test"
```

With **language** set to `python`, a matching pair of outer quotes is stripped and the body is decoded with Python's escapes, including `\xNN` and `\UXXXXXXXX`:

```example
title: python single-quoted literal
params: {"language": "python"}
input: 'caf\xe9 \U0001F600'
output: café 😀
```

### Octal and hex escapes

Octal escapes (up to three digits, at most `\377`) and `\xNN` hex escapes (at most two digits are read) each decode to one character in the range U+0000–U+00FF:

```example
title: decodes octal escapes (C)
params: {"language": "c"}
input: \101\102
output: AB
```

```example
title: decodes hex, \u and brace unicode escapes
input: \x41\u00e9\u{1F600}
output: Aé😀
```

`\u{...}` (the ES2015 brace form) and 4-digit `\uXXXX` escapes are also understood, including surrogate pairs: two consecutive `\uXXXX` escapes that form a valid UTF-16 pair recombine into a single character automatically, the same way JavaScript strings themselves work.

## Options

- **language**: `javascript` (default), `json`, `c`, `java`, `python`, `go`, `csharp`, `php`, `ruby`, or `sql`. Controls which escape sequences are recognized and how the delimiter is handled.

### Per-language decoding rules

| language / quote | how it's decoded |
| --- | --- |
| `json` | strict: only `"`, `\`, `/`, `b`, `f`, `n`, `r`, `t` and `\uXXXX` are legal; anything else throws |
| `go`, backtick quote | a raw string literal; nothing is decoded, the body is returned as-is |
| `sql` | no backslash escapes; a doubled delimiter character (`'` when the input has no surrounding quotes) decodes to one delimiter character |
| `php` / `ruby`, single quote | only `\\` and `\'` mean anything; everything else is left exactly as written |
| everything else | `\n \r \t \b \f \v \a \e`, `\0`/octal, `\xNN`, `\uNNNN`, `\u{...}`, `\UNNNNNNNN`, and a backslash immediately before a real line break (a line continuation, which is dropped) |
| `python` / `php` | an unrecognized escape like `\q` is kept as-is (`\q`), rather than having its backslash dropped |
| `ruby`, `java`, `csharp`, `c`, `go`, `javascript` | an unrecognized escape has its backslash dropped (`\q` becomes `q`). This is lenient, since real Java and Go compilers reject unknown escapes outright |

## Common uses

- Converting a string literal copied from source code back into the plain text it represents, for editing or comparison.
- Reversing output from [code string escape](/util/code_string_escape/) to recover the original value.
- Reading escaped values out of a config file, log line, or generated code snippet written in a specific language.
- Normalizing string literals from different languages into plain text before further processing.

## Tips and pitfalls

- JSON decoding is intentionally strict. An escape JSON doesn't define (like `\q` or a bare `\'`) throws an error, matching how a real JSON parser would reject it.
- A trailing, unpaired backslash at the end of the input always throws, since it can't be the start of a complete escape sequence.
- Quote stripping only removes a *matching* pair at the very start and end of the input; a stray quote in the middle of the text, or mismatched quote characters, is left alone.
- To go the other direction, use [code string escape](/util/code_string_escape/). For the body of a JSON string, [JSON unescape](/util/json_unescape/) does the same job using `JSON.parse` itself.
