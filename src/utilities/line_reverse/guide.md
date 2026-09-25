---
title: Reverse Line Order Online — Flip Text Line by Line
description: Reverse the order of the lines in a block of text online, like the Unix tac command, while keeping each line's content intact.
---
## What does reversing line order do?

Reversing line order flips a multi-line text upside down — the last line becomes the first and the first becomes the last — without touching the characters inside any individual line. It is the same idea as the Unix `tac` command (`cat` spelled backward), and it is a different operation from [reverse](/util/reverse/), which flips the characters within a string, and from [reverse word order](/util/reverse_words/), which flips the words within a line.

## How it works

The tool splits the input into lines, reverses the order of those lines, and joins them back together. The content of every line stays exactly as it was — only which line comes first, second, and so on changes.

```example
title: reverse three lines
input: one
two
three
output: three
two
one
```

A trailing newline at the end of the document is preserved: if the input ends in a newline, so does the output.

```example
title: a trailing newline is kept
input:
one
two
three

output:
three
two
one

```

Blank lines are treated as lines in their own right and move along with everything else:

```example
title: blank lines are preserved as lines
input: a

b
output: b

a
```

## Options

This utility has no configurable options — it always reverses the full set of lines in the input.

## Common uses

- Viewing a log file with the newest entries at the top instead of the bottom.
- Reversing the row order of a plain-text list or export before further processing.
- Undoing a previous line reversal, since running the tool twice on the same text restores the original order — it is its own inverse.
- Preparing text for a diff or comparison where line order needs to be flipped without touching line content.

## Tips and pitfalls

- Only the order of the lines changes; nothing inside a line is reordered, so multi-character sequences like an emoji built from several code points stay intact.
- Line endings stay at their original positions rather than travelling with the line's content: the first output line gets the terminator the first input line had, and so on. A file that uses one ending throughout (all LF, or all CRLF) reverses exactly as expected. In a mixed file, `a` + CRLF, `b` + LF, `c` with no ending becomes `c` + CRLF, `b` + LF, `a` with no ending — which keeps a missing final newline missing and makes a second run restore the original exactly. (GNU `tac` handles an unterminated last line differently: it glues that line onto the start of the next one it prints.)
- Only LF and CRLF count as line breaks; a lone carriage return stays inside its line.
- An empty input stays empty, and a single line with no line break at all is returned unchanged.
- To reverse the characters within each line instead of the order of the lines, use [reverse](/util/reverse/); to reverse the order of words within a line, use [reverse word order](/util/reverse_words/).
- To keep only the first or last few lines rather than reordering all of them, use [head](/util/head/) or [tail](/util/tail/).
