---
title: Remove Diacritics Online: Strip Accents from Text
description: Strip accents and diacritical marks from text online, turning café into cafe or naïve into naive, using Unicode NFD decomposition.
---
## What are diacritics?

A diacritic is a mark added to a letter to change its pronunciation or meaning: the acute accent in `café`, the diaeresis in `naïve`, the umlaut in `Zürich`, the tilde in `jalapeño`. This tool strips those marks and leaves the base letter behind, so `café` becomes `cafe` and `Zürich` becomes `Zurich`. It is a plain-text fallback for search, sorting, filenames, and any system that only expects unaccented ASCII letters.

```example
title: accented letters lose their marks
input: café déjà vu
output: cafe deja vu
```

## How it works

The tool relies on a Unicode normalization form called **NFD** (Normalization Form Canonical Decomposition, defined in [Unicode Standard Annex #15](https://unicode.org/reports/tr15/)). NFD rewrites a precomposed accented letter (a single character like `é`) as two characters: the plain base letter `e` followed by a separate **combining mark**, an accent character that renders attached to the letter before it. Once the accent is split out as its own character, the tool deletes every character in the [Combining Diacritical Marks block, U+0300–U+036F](https://www.unicode.org/charts/PDF/U0300.pdf), which leaves the base letters behind.

```example
title: an umlaut and an accent both come off
input: naïve Zürich
output: naive Zurich
```

Because this only removes *combining* marks, it does not touch a letter that merely looks related but is its own distinct character in Unicode rather than a base letter plus an accent. `Ø` and `ø`, for example, are not decomposable. NFD leaves them exactly as they are, so this tool passes them through unchanged rather than turning them into `O`/`o`.

```example
title: standalone letters like Ø are not diacritics and stay unchanged
input: Øresund
output: Øresund
```

## Options

This utility has no configurable options. It always decomposes with NFD and strips every mark in the U+0300–U+036F block. If you need a specific normalization form instead of stripped accents, use [normalize](/util/normalize/) directly; NFD alone (without the removal step) is one of its four output forms.

## Common uses

- Generating a plain-ASCII slug, filename, or username from a name that contains accents (pair with [slug](/util/slug/), which also strips accents as part of building a URL-friendly string).
- Loosening a text search so that a query for "resume" also matches "résumé".
- Preparing text for a system, protocol, or font that only supports basic Latin letters.
- Normalizing user input before comparing or sorting strings from different keyboards and locales that may or may not include accents.

## Tips and pitfalls

- This is a lossy, one-way transformation: once diacritics are removed, there is no way to recover which letters were originally accented. Keep the original text if you need it later.
- Only accents that NFD splits off into the U+0300–U+036F block are removed. Letters that are unique code points in their own right (`Ø`, `ø`, `Ł`, `ł`, `Ð`, `Þ`, and the German `ß`) are not "letter plus accent" under Unicode and are left as-is, so the output is not guaranteed to be pure ASCII.
- The result is not recomposed afterwards. Characters that NFD splits apart but whose marks lie outside that block stay decomposed: Korean Hangul syllables come out as separate jamo, and Japanese kana with a voicing mark (`が`) as the base kana plus a combining mark. They usually look the same but no longer compare equal to the original; run [normalize](/util/normalize/) with NFC afterwards to recompose them.
- If your text mixes precomposed and already-decomposed accented letters (for example, after editing in different tools), running [normalize](/util/normalize/) with NFC first and then this tool afterward, or simply running this tool directly since it decomposes internally, gives the same accent-free result either way.
- Other scripts are affected too, not just Latin. Greek tonos comes off (`ά` becomes `α`), and Cyrillic letters that decompose lose their marks, which changes letters in languages like Russian: `й` becomes `и` and `ё` becomes `е`. Marks outside U+0300–U+036F, such as Arabic vowel marks, are not removed. The tool never transliterates one script into another.
