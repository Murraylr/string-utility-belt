---
title: Clean Up Text Pasted From Word: Quotes, Dashes, Bullets
description: Paste text copied from a Word document and get clean plain text: straight quotes, real hyphens, readable bullets, no hidden characters.
---

## Paste as plain text is not enough

Word's Keep Text Only paste option, or Ctrl+Shift+V in a browser, throws away fonts, colours and bold. It does not change a single character, and the characters are what cause the trouble. While you typed, Word's AutoFormat quietly swapped your straight quotes for curly ones, turned `--` into an em dash and `...` into a one-character ellipsis. You may also have added optional hyphens, which are invisible until a line wraps, and no-break spaces that look exactly like spaces. Lists are worse: a bullet reaches the clipboard as a symbol followed by a tab, and the symbol for a second-level bullet is a plain letter o.

None of that shows on screen, yet all of it matters elsewhere. A shell command or a JSON value copied out of a runbook fails because of its curly quotes. A product name with an optional hyphen inside does not match a search for the same name. A form that only accepts plain ASCII rejects the paste outright, and a CMS shows `o` in front of every sub-item of a list.

## What each step does, and why in this order

[Remove invisible characters](/util/remove_invisible/) goes first. It deletes soft (optional) hyphens, zero-width spaces and byte order marks, so the later steps see the line exactly as it looks. [Collapse whitespace](/util/collapse_whitespace/) then turns no-break spaces into ordinary ones, collapses double spaces after full stops, trims every line and squeezes the run of blank lines that empty paragraphs leave behind into a single one. Tabs in the middle of a line are kept, so a table copied out of Word still lands in separate columns when you paste it into a spreadsheet.

The [sed script](/util/sed/) step rewrites list items. Word's default bullets come through as · for the first level, o for the second and § for the third (a Wingdings square that turns into a section sign outside Word), each followed by a tab. They become `-` bullets, with the second and third levels indented under the first, and `1.<tab>` numbers become `1. `. This has to run after the trim, which would otherwise strip the indents it adds.

[Find and replace](/util/multi_replace/) reverses AutoFormat's dashes: an em dash goes back to the `--` that produced it, an en dash back to a single hyphen, and a non-breaking hyphen, which looks identical to an ordinary one, becomes the ordinary one. Finally [smart quotes](/util/smart_quotes/) straightens curly double and single quotes, apostrophes included, French guillemets too, and turns `…` back into three dots.

## What it leaves alone

This is a cleanup, not a conversion to ASCII. Accented letters, ©, ° and other real symbols stay as they are; add [remove diacritics](/util/diacritics/) at the end if your target cannot take accents either. Links lose their address when Word puts plain text on the clipboard, and no step can bring it back. Numbered lists come out flat, because a copied number does not say which level it was on, and bullets from a custom list style may use symbols other than Word's defaults: add them to the sed step's character lists.

Text from other sources needs other fixes. Answers copied from ChatGPT come with Markdown symbols, which [removing ChatGPT formatting](/presets/clean-chatgpt-text/) deals with, and text copied from a PDF breaks every line at the page edge, which [fixing PDF line breaks](/presets/fix-pdf-line-breaks/) joins back up.

## Stopping Word from doing it in the first place

For documents you write yourself, open File, Options, Proofing, AutoCorrect Options, and on the AutoFormat As You Type tab clear "Straight quotes with smart quotes" and "Hyphens (--) with dash (—)". That only affects what you type from then on; text already in the document keeps its curly quotes until you replace them. For runbooks and other documents that hold commands, keep each command in a code-formatted block, or in a plain text file the document links to, so nobody has to copy it out of prose at all.
