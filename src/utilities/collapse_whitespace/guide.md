---
title: Collapse Whitespace Online — Squeeze Extra Spaces
description: Collapse repeated spaces to one, limit blank lines, trim every line, and normalize tabs or Unicode spaces like NBSP — all in one pass.
---
## What does collapsing whitespace mean?

Pasted text — from a PDF, a chat app, or an email client — often carries messy whitespace: double spaces left over from justified text, a trail of blank lines, and invisible characters like a non-breaking space (NBSP) standing in for a regular one. Collapsing whitespace cleans all of that up in a single step: runs of spaces become one space, runs of blank lines are limited to one, each line is trimmed, and Unicode look-alike spaces are turned into plain ASCII spaces. It is a broader cleanup than [trim](/util/trim/), which only removes whitespace from the very start and end of the whole text.

```example
title: squeeze repeated spaces and blank lines
input: hello    world  


foo
output: hello world

foo
```

## How it works

Five independent switches control the cleanup, and they run in a fixed order:

1. **unicode spaces** (default on) turns every Unicode space separator — non-breaking space, ideographic space, en/em quad, and the rest of the `\p{Zs}` category — into a plain space character.
2. **tabs to spaces** (default off) turns tab characters into spaces.
3. **collapse runs of spaces to one** (default on) squeezes two or more plain space characters into a single space. It only matches the literal space character, so it runs after the previous two steps convert other whitespace into spaces.
4. **trim each line and the whole text** (default on) strips leading and trailing whitespace from every line individually — without disturbing the line breaks themselves. The text as a whole is trimmed once more at the very end, after step 5.
5. **collapse blank lines** (default on, labeled "collapse 3+ newlines to 2") limits a run of three or more consecutive line breaks to two, which leaves at most one blank line between paragraphs. Two consecutive breaks (a single blank line) are left alone.

```example
title: three or more blank lines become one
input: first paragraph



second paragraph
output: first paragraph

second paragraph
```

## Why tabs survive by default

Collapsing spaces only ever touches the ASCII space character, never a tab — even though **collapse runs of spaces to one** is on by default. This is deliberate: tab-separated data (a pasted spreadsheet row, a TSV file) uses tabs as field delimiters, and an empty field between two tabs must not be silently merged away. Turn on **tabs to spaces** explicitly if you want tabs converted too.

Trimming does remove tabs, though. With **trim each line and the whole text** on, a tab at the very start or end of a line is stripped, so a row whose first or last field is empty loses that field. Turn trimming off for tab-separated data like that.

```example
title: tab-delimited fields survive the default settings
input: col1		col3
output: col1		col3
```

## Options

- **collapse runs of spaces to one** — squeezes `"a    b"` to `"a b"`. Default on.
- **collapse 3+ newlines to 2** — limits any run of blank lines to a single blank line. Default on.
- **trim each line and the whole text** — removes leading/trailing whitespace per line, then trims the overall result. Default on.
- **tabs to spaces** — converts every tab character to a space. Default off.
- **unicode spaces (NBSP etc.) to normal spaces** — folds every Unicode space-separator character into a plain space before the other options run. Default on.

Turning every option off makes the tool a complete no-op.

## Common uses

- Cleaning text copied from a PDF or a web page before pasting it somewhere whitespace-sensitive, such as code or a config file.
- Normalizing writing before a word count, a diff, or a search — so cosmetic spacing differences do not register as real changes.
- Removing the excess blank lines that build up when merging or editing plain-text documents.
- Converting invisible Unicode spaces (which look identical to a normal space but are a different character) into ordinary ones before further processing.

## Tips and pitfalls

- The whitespace collapse and trimming happen in the fixed order above; if you disable **unicode spaces**, a run of NBSPs will not be collapsed even with **collapse runs of spaces to one** on, because the collapse step only matches plain ASCII spaces.
- Accented letters and emoji are left completely alone — only whitespace characters are touched.
- This tool does not reformat paragraphs or wrap lines; for wrapping to a fixed width, see [word_wrap](/util/word_wrap/). For trimming only the very start and end of the whole text, [trim](/util/trim/) is simpler. For removing blank lines entirely rather than limiting them to one, use [remove_blank_lines](/util/remove_blank_lines/).
- If you need to make invisible characters visible for debugging instead of removing them, try [unicode_inspect](/util/unicode_inspect/).
