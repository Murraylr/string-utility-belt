---
title: Truncate Text Online: Shorten Strings with Ellipsis
description: Cut text down to a maximum length online, adding an ellipsis when it gets clipped, with a customizable length and ellipsis text.
---
## What does truncating text mean?

Truncating shortens text to a maximum length, and (unlike a plain [string slice](/util/slice/)) it also signals that something was cut off by appending an ellipsis (`…`) in place of the last few characters. This is the operation behind a card preview that ends in "…", a table cell that can't grow past a fixed width, or a notification that shows only the start of a longer message.

## How it works

The tool compares the input's length against the **max length** option. If the text already fits, it is returned completely unchanged. Truncation never pads short text out to the target length the way [pad](/util/pad/) does.

```example
title: text that already fits is untouched
params: {"length": 15}
input: Hi
output: Hi
```

When the text is longer than the limit, the tool reserves room for the **ellipsis** at the end and cuts the rest of the text short enough to make room for it, so the *total* output length (text plus ellipsis) never exceeds the limit you set:

```example
title: longer text is cut short and gets an ellipsis
params: {"length": 15}
input: Hello, World! This is a test.
output: Hello, World! …
```

The ellipsis string is configurable, so you can use three periods instead of the single "…" character if you prefer:

```example
title: use "..." as the ellipsis instead
params: {"length": 8, "ellipsis": "..."}
input: hello world
output: hello...
```

If **max length** is `0`, the input is returned unchanged no matter how long it is. `0` is treated as "no limit", not "cut everything". And if the limit is no longer than the ellipsis itself, leaving no room for any text in front of it, the tool falls back to a plain cut to exactly **max length** characters, with no ellipsis at all:

```example
title: a max length of 0 means no limit at all
params: {"length": 0}
input: hello
output: hello
```

```example
title: a limit too small for the ellipsis just slices
params: {"length": 1, "ellipsis": "..."}
input: hello world
output: h
```

## Options

- **max length**: the maximum length of the result, including the ellipsis. Defaults to `20`. `0` means no limit at all, not zero characters; negative values are not accepted.
- **ellipsis**: the string appended when text is cut short. Defaults to a single "…" character. An empty ellipsis truncates with a plain cut and no marker.

## Common uses

- Shortening titles, summaries or descriptions to fit a card, list item or notification.
- Producing a preview snippet of a longer document or message.
- Enforcing a display-length limit on user-generated content without hiding that it was cut off.
- Building fixed-width log or table output where an overly long value needs a visible marker that it was clipped.

## Tips and pitfalls

- A **max length** of `0` is a "do nothing" value, not "clip everything". If you want to test the small-limit edge cases, use `1` or a small positive number instead.
- Length here is counted in UTF-16 code units, the same units JavaScript uses internally, so an emoji or rare CJK character stored as a surrogate pair counts as 2, and the cut can land between the two halves and leave a broken character just before the ellipsis.
- If the **max length** is smaller than or equal to the length of the ellipsis text, the ellipsis is dropped entirely and the text is cut to exactly that length. That is worth knowing if you configure a very short limit with a multi-character ellipsis like "...".
- Unlike [pad](/util/pad/), truncate never adds characters to short text. The two are natural complements when you need output at exactly a fixed length either way.
- To cut text at a specific character position rather than a maximum length, use [string slice](/util/slice/) instead, which has no concept of an ellipsis.
