---
title: Fix /bin/bash^M: bad interpreter (CRLF, BOM, NBSP)
description: Script fails with ^M: bad interpreter or $'\r': command not found? Convert CRLF to LF and fix the BOM, no-break spaces and trailing spaces.
---

## What ^M and $'\r' mean

Windows ends each line of a text file with a carriage return and a line feed (CRLF); Linux and macOS use the line feed alone. A script saved by a Windows editor, or checked out by Git on Windows with `core.autocrlf=true`, has a carriage return at the end of every line. `cat -v` shows that character as `^M`, and bash quotes it as `$'\r'`.

The kernel reads the interpreter path from the shebang up to the line feed, so `#!/bin/bash` followed by CRLF asks for a program named `/bin/bash` plus a carriage return, which does not exist. Older bash releases report `/bin/bash^M: bad interpreter: No such file or directory`, bash 5.2 says `cannot execute: required file not found`, and zsh, the default shell on macOS, says `bad interpreter: /bin/bash^M: no such file or directory`. With `#!/usr/bin/env bash` the error comes from env: `/usr/bin/env: 'bash\r': No such file or directory`, and the same happens with `python3\r` or any other interpreter. A container runtime that starts the script directly reports "no such file or directory" for a file that is plainly there.

Run it as `bash deploy.sh` and the shebang is skipped, but every other line still ends in a carriage return: blank lines fail with `$'\r': command not found`, `cd /tmp` looks for a directory whose name ends in a carriage return, `set -euo pipefail` stops the script because `pipefail\r` is not an option name, and an `if` block ends in `syntax error: unexpected end of file` because `then` and `fi` followed by a carriage return are not keywords.

## Why converting line endings is not always enough

The dos2unix tool fixes the carriage returns. Scripts copied from a wiki, a chat message or a web page often bring other problems, and the worked example above has all of them:

- A byte order mark. Editors that save as "UTF-8 with BOM" write the bytes EF BB BF before `#!`. The kernel only treats a file as a script when its first two bytes are `#!`, so a direct start fails with "Exec format error". Bash, on that error, runs the file as a bash script itself: line 1 fails with what looks like `#!/usr/bin/env: No such file or directory`, and the rest runs in bash whatever the shebang names.
- No-break spaces (U+00A0), which rich-text editors and web pages use to keep runs of spaces from collapsing; on a Mac, Option+Space types one. Bash splits words only on spaces and tabs, so two of them before `echo` make the command name `$'\302\240\302\240echo'` (the UTF-8 bytes C2 A0, in octal). Under a UTF-8 locale bash prints the raw characters instead, and the message reads like `echo: command not found`.
- Zero-width spaces (U+200B), which some sites insert so long words can wrap. Nothing shows, but the program receives `--timeout=120s` with three extra bytes attached.
- Spaces after a line-continuation backslash. The backslash escapes the space instead of the newline, so the command ends there and the next line runs on its own: `-n: command not found`.

## What each step does, and why in this order

[Invisible characters](/util/remove_invisible/), in remove mode, deletes the BOM, zero-width characters, soft hyphens, direction marks, variation selectors and control characters other than tab, line feed and carriage return. [Replace](/util/replace/) turns every Unicode space separator (category Zs) except the plain space into a plain space; narrow its character class if the script prints text that should keep, say, a thin space. [Normalize line endings](/util/normalize_line_endings/) converts CRLF and lone CR to LF and adds a missing final newline. Text pasted into the box on this page has already lost its carriage returns (browsers store line breaks in a text box as LF), so this step matters for the examples and for a script file you open in the editor, where the bytes arrive untouched. [Trim each line](/util/trim_lines/), set to the end only, removes trailing whitespace and keeps indentation.

The order matters in one place. A zero-width space is not whitespace, so one at the end of a line would shield the spaces before it from the trim: invisible characters have to go before trimming. Swapping the other steps around gives the same result.

## What it does not fix

- Removing invisible characters is not limited to the BOM. Zero-width joiners and emoji variation selectors go too, so an emoji in an echo string can change appearance, and a raw escape byte (0x1B) pasted into a colour code is deleted. Escapes written as `\e` or `\033` are ordinary text and stay.
- Trailing whitespace is also trimmed inside heredocs and multi-line strings, where it may be intended.
- Curly quotes and en dashes from a word processor stay. Bash treats them as ordinary characters (`–n` is not an option), and straightening them blindly would turn an apostrophe (’) inside a single-quoted string into its end, so fix those by hand.
- Lines ending in two carriage returns (CR CR LF, left by converting an already-CRLF file to CRLF again) come out double-spaced, which breaks backslash continuations. Add a [Replace](/util/replace/) step first with the pattern `\r+(?=\n)` and an empty replacement.
- The fix only sticks if the file is saved with LF. VS Code keeps one line ending per file, so pasting the result into a file it opened as CRLF puts the carriage returns back: switch the CRLF indicator in its status bar to LF (Edit > EOL Conversion in Notepad++) and save as UTF-8 without a BOM.
- "Permission denied" is a different problem, usually fixed with `chmod +x`.

## Doing it on the command line

`file deploy.sh` reports "with CRLF line terminators" and "(with BOM)", `cat -A deploy.sh` shows each carriage return as `^M` and the BOM as `M-oM-;M-?`, and in a UTF-8 locale `grep -nP '\x{A0}|\x{200B}|\x{FEFF}' deploy.sh` lists the lines with a no-break space, zero-width space or BOM. `dos2unix deploy.sh` converts the line endings and by default removes a BOM, but leaves the other characters alone; in Vim, `:set ff=unix nobomb` followed by `:w` does the same. With GNU sed, `sed -i 's/\r$//' deploy.sh` strips the carriage returns, and `LC_ALL=C sed -i -e '1s/^\xEF\xBB\xBF//' -e 's/\r$//' -e 's/\xC2\xA0/ /g' -e 's/\xE2\x80\x8B//g' -e 's/[ \t]*$//' -e '$a\' deploy.sh` makes the same fixes as the four steps for those common characters, final newline included.

To keep it from coming back, add `*.sh text eol=lf` to the repository's .gitattributes: Git then checks shell scripts out with LF on every platform, whatever `core.autocrlf` says. Scripts already committed with CRLF need `git add --renormalize .` and a commit. The [gitattributes documentation](https://git-scm.com/docs/gitattributes) has the details.
