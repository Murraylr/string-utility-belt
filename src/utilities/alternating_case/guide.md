---
title: Alternating Case Converter: Make SpOnGeBoB Text Online
description: Convert text to alternating case (SpOnGeBoB mocking case) online. Toggle upper and lower case letter by letter, with options for punctuation and spacing.
---
## What is alternating case?

Alternating case (widely known as "SpongeBob case" or mocking case, after the meme image of SpongeBob SquarePants) flips between lowercase and uppercase on every letter, producing text like `hElLo WoRlD`. It is used to signal sarcasm or mockery in chat and social media, as a joke font, or just as a novelty way to restyle a message. It carries no other meaning: it does not change spelling, word order, or which characters are letters.

## How it works

The tool walks through the text one character at a time and keeps a running counter of how many letters it has seen. A letter at an even position in that count is lowercased or uppercased according to the starting case, and the next letter flips to the other case, and so on:

```example
title: default alternation, starting lowercase
input: hello world
output: hElLo WoRlD
```

Turning on **start uppercase** flips which case comes first, so the very first letter is capitalized instead:

```example
title: start uppercase instead of lowercase
params: {"startUpper": true}
input: hello world
output: HeLlO wOrLd
```

By default, anything that is not a letter (spaces, digits, punctuation) is copied through untouched and does not use up a turn in the counter, so the alternation continues across it as if it were not there. Unchecking **skip non-letters** makes non-letter characters consume a turn too, which shifts the case of every letter that follows: notice how `world` flips from `WoRlD` above to `wOrLd` here, purely because the space between the two words now counts as a step.

```example
title: let spaces and punctuation take a turn
params: {"skipNonLetters": false}
input: hello world
output: hElLo wOrLd
```

Letters are detected with the Unicode letter category, not an ASCII check, so accented letters and cased scripts such as Greek and Cyrillic alternate the same way ordinary letters do. Letters from scripts without case, such as Chinese or Arabic, still count as letters and use up a turn, but have no case to change. Emoji and other symbols are never letters, so they are always passed through unchanged and, under the default setting, never break the alternating rhythm.

```example
title: empty input returns unchanged
input:
output:
```

## Options

- **start uppercase** (`startUpper`, default `false`): when `false` the first letter is lowercased; when `true` it is uppercased. Every later letter alternates from there.
- **skip non-letters** (`skipNonLetters`, default `true`): when `true`, spaces, digits and punctuation are left alone and do not advance the alternation. When `false`, every character advances it, so the position of a space or punctuation mark can shift which letters end up upper or lower.

## Common uses

- The "mocking SpongeBob" meme format, used to imply sarcasm in a quoted or paraphrased statement.
- Casual, attention-grabbing text for chat, forum posts, or social media captions.
- A quick way to visually distinguish a string in test data or a demo from ordinary text.

## Tips and pitfalls

- Alternating case is entirely positional: running the output back through the tool with the same options reproduces the same text again, rather than toggling it back to the original, because the case of each output letter no longer depends on what it was before.
- If you want a different flavor of unpredictable casing, try [random case](/util/random_case/), which flips each letter independently at a chosen probability instead of strictly alternating.
- To invert every letter's case exactly once instead of alternating, use [swap case](/util/swap_case/).
- For other playful text transforms, see [leet speak](/util/leet/) and [unicode text style](/util/unicode_style/), which can be chained after this one in a pipeline.
