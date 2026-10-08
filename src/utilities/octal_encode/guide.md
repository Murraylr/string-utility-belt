---
title: Octal Encode Online: Text to Octal Converter
description: Convert text or bytes to zero-padded octal (base-8) byte triples online, with a custom separator: the digits used in C-style octal escapes.
---
## What is octal encoding?

Octal (base 8) writes each byte of data as three digits from `0` to `7`. Three octal digits cover exactly 9 bits, enough to represent every byte value from 0 to 255 (`000` to `377` in octal). So, like [hex encode](/util/hex_encode/)'s two digits per byte, every byte gets a fixed-width representation. Octal is less common than hex for general-purpose byte dumps today, but it's still the standard notation for Unix file permissions (`chmod 755`) and shows up in escape sequences in C, shell `printf` and Python (`\101` for `A`). Note that this tool encodes bytes, not numbers: to write a permission value or any other number in octal, use [number base convert](/util/number_base_convert/).

## How it works

1. Text is converted to UTF-8 bytes first; raw bytes from a previous step are used as-is.
2. Each byte (0–255) is converted to base 8 and left-padded with `0`s to exactly three digits.
3. The triples are joined with a separator (a single space by default).

```example
title: each byte becomes a zero-padded octal triple
input: Hi!
output: 110 151 041
```

### Unicode text

A character outside plain ASCII becomes multiple UTF-8 bytes first, each encoded as its own triple:

```example
title: a multi-byte utf-8 character
input: é
output: 303 251
```

### Custom separators

The **separator** field accepts `\n`, `\t`, `\r`, `\0`, and `\\` typed literally, in addition to any plain text or punctuation, or it can be left empty to run the triples together with no gap at all:

```example
title: no separator between triples
params: {"separator": ""}
input: Hi
output: 110151
```

```example
title: a newline between triples
params: {"separator": "\n"}
input: AB
output:
101
102
```

Typing `\\` as the separator puts a single backslash between triples, which gets you most of the way to an escape sequence:

```example
title: a backslash separator for escape sequences
params: {"separator": "\\\\"}
input: ABC
output: 101\102\103
```

Empty input produces an empty string:

```example
title: empty input
input:
output:
```

## Options

- **separator**: the text between octal triples (default a single space). Leave it empty to concatenate the triples directly; [octal decode](/util/octal_decode/) can still split such a run back into triples.

## Common uses

- Producing octal escape sequences for C, shell `printf`, or Python byte strings: with the separator set to `\\`, `ABC` becomes `101\102\103`, which only needs a leading backslash.
- Comparing byte representations against [hex encode](/util/hex_encode/) (2 digits per byte, more compact) or [binary encode](/util/binary_encode/) (8 digits per byte, most explicit).

## Tips and pitfalls

- Every triple is always exactly 3 digits, `000` to `377`. There's no way to produce a shorter or longer group, which keeps the output unambiguous to split back apart even without a separator.
- Octal encoding is not compression or encryption; it makes data larger (3 characters per byte) and hides nothing.
- To reverse this, use [octal decode](/util/octal_decode/), which also tolerates backslash-style escapes and `0o` prefixes that this tool doesn't produce itself.
