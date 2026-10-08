---
title: Translate Characters Online: POSIX tr Tool
description: Translate, delete or squeeze characters online like the Unix tr command, with a-z ranges and POSIX [:class:] expansion.
---
## What is the tr command?

`tr` (translate) is a classic Unix tool for character-by-character text transformation: map one set of characters onto another, delete a set outright, or collapse runs of repeated characters down to one. Unlike [find and replace](/util/replace/) or [sed script](/util/sed/), it never matches multi-character patterns. Every operation works one character at a time, which makes it the right tool for jobs like case-folding, deleting a class of characters, or squeezing repeated whitespace.

## How it works

Two character sets, **from** and **to**, define the translation: every character in **from** is replaced by the character at the same position in **to**.

```example
title: uppercase every letter with an a-z range
params: {"from": "a-z", "to": "A-Z"}
input: hello world
output: HELLO WORLD
```

Ranges like `a-z` and POSIX character classes like `[:upper:]` or `[:digit:]` expand to the full list of characters they represent, so you rarely need to type out every character by hand. The classes contain ASCII characters only (`[:upper:]` is `A`–`Z`, so `É` is not part of it), while a range covers every code point between its ends. Because `[:upper:]` and `[:lower:]` list their letters in the same order, one maps onto the other:

```example
title: expand POSIX character classes
params: {"from": "[:upper:]", "to": "[:lower:]"}
input: Hello World!
output: hello world!
```

If **to** is shorter than **from**, its last character is reused to pad out the rest, so `from: "abcd", to: "xy"` maps `a→x`, `b→y`, `c→y`, `d→y`. If **to** is longer, the extra characters are ignored, and if **to** is empty (with **delete** off) nothing is translated. Turning on **delete** removes every character in **from** outright instead of translating it:

```example
title: delete every vowel
params: {"from": "aeiou", "delete": true}
input: hello world
output: hll wrld
```

**Squeeze** collapses consecutive repeats of a character down to a single occurrence. Whenever **to** is non-empty, the set that gets squeezed is **to** (the characters *after* translation, or with **delete** on, the second set as in `tr -ds`); when only **from** is given, it is **from**:

```example
title: squeeze repeated spaces down to one
params: {"from": " ", "squeeze": true}
input: a   b  c
output: a b c
```

A classic use of two ranges together is a ROT13-style rotation, mapping the alphabet onto a shifted copy of itself:

```example
title: rotate the alphabet by 13 with paired ranges
params: {"from": "A-Za-z", "to": "N-ZA-Mn-za-m"}
input: Hello, World
output: Uryyb, Jbeyq
```

## Options

- **from set**: the characters to match, as literal characters, `a-z`-style ranges, or `[:class:]` names (`alpha`, `alnum`, `digit`, `lower`, `upper`, `space`, `blank`, `punct`, `print`, `graph`, `cntrl`, `xdigit`), all ASCII-only.
- **to set**: the characters to translate matches into, position by position. When **delete** is on it is not used for translation, only as the squeeze set.
- **delete "from" characters**: removes every character in **from** from the output instead of translating it. Default off.
- **squeeze repeats**: collapses consecutive repeats of a character in the squeeze set (**to** if given, otherwise **from**) to one. Default off.
- **expand a-z ranges and [:classes:]**: when on (the default), `a-z` and `[:class:]` syntax is expanded as described above; when off, `-` and `[`/`]` are treated as ordinary literal characters, so `a-z` means the three characters `a`, `-`, `z` rather than a range.

## Common uses

- Case-folding ASCII letters without touching anything else. For accented and non-Latin letters, use a dedicated [change case](/util/case/) step instead.
- Removing an entire class of characters, such as all digits or all punctuation, using `[:digit:]` or `[:punct:]` with delete.
- Collapsing repeated whitespace or a repeated punctuation character (like `!!!` to `!`) with squeeze.
- Building a simple substitution cipher, or reversing one, using two character ranges.

## Tips and pitfalls

- Ranges and classes only expand when **expand a-z ranges and [:classes:]** is on; turn it off if you actually need a literal hyphen or bracket in your set.
- Backslash escapes work inside both sets: `\t`, `\n`, `\r`, octal (`\012`), hex (`\x41`) and Unicode (`\u00a9`, `\u{1F600}`) escapes all resolve to the character they represent before matching, and `\-` or `\\` give a literal hyphen or backslash. The `\x` and `\u` forms go beyond what POSIX `tr` accepts.
- There is no complement option (`tr -c`), so "every character not in this set" cannot be expressed here.
- An inverted range like `z-a` (end before start) is rejected with an error rather than silently matching nothing.
- For matching whole substrings or patterns rather than individual characters, use [find and replace](/util/replace/). To remove Unicode-aware categories that the ASCII-only classes miss, such as accented letters, non-Latin digits or emoji, use [strip characters](/util/strip_chars/).
- For a character mapping inside a larger script with addresses and multiple commands, use the `y` command in [sed script](/util/sed/); it takes no ranges or classes, and both of its sets must be the same length.
