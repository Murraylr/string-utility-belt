---
title: Punycode Encoder — Convert Unicode Domains to ASCII
description: Convert an internationalized domain name or any Unicode text to Punycode (RFC 3492) with the xn-- prefix, per label or as raw bootstring output.
---
## What is Punycode?

Domain names were originally ASCII-only, but people need to register domains in every script — Cyrillic, Arabic, Chinese, accented Latin. [Punycode](https://www.rfc-editor.org/rfc/rfc3492) (RFC 3492) is the encoding that makes this possible: it represents any Unicode text using only ASCII characters — for a domain label, just letters, digits and hyphens, which DNS can carry unchanged. Under IDNA (the domain-name application of Punycode), the ASCII form is marked with an `xn--` prefix so software can tell it apart from an ordinary label. `münchen.de` becomes `xn--mnchen-3ya.de` — browsers do this conversion behind the scenes when you type a non-ASCII domain.

## How it works

In the default **domain** mode, the input is split on `.` and each label is encoded independently — the same way a real hostname is handled, since each part between dots is its own DNS label. Only the ASCII full stop splits labels (not look-alikes such as the ideographic `。`), and the DNS limit of 63 characters per label is not checked.

```example
title: an internationalized domain name
input: münchen.de
output: xn--mnchen-3ya.de
```

A label that is already pure ASCII, like `de` above, is left untouched — there is nothing to encode, and adding an `xn--` prefix to it would be wrong. Only labels containing non-ASCII characters are converted and prefixed.

```example
title: multiple non-ASCII labels
input: 例え.テスト
output: xn--r8jz45g.xn--zckzah
```

### Label and raw modes

**label** mode treats the entire input as a single label, ignoring any dots in it — useful when you have one hostname component rather than a full domain, or when the text simply is not a domain at all.

```example
title: label mode treats dots as ordinary characters
params: {"mode": "label"}
input: münchen
output: xn--mnchen-3ya
```

**raw** mode skips the `xn--` prefix and IDNA label handling entirely, emitting the bare RFC 3492 bootstring output — useful for verifying the encoding algorithm itself, or when Punycode is used outside of domain names.

```example
title: raw bootstring output, no xn-- prefix
params: {"mode": "raw"}
input: café
output: caf-dma
```

### Punycode only, not full IDNA processing

This tool applies the RFC 3492 algorithm and nothing else. Before encoding, a browser or registrar also runs the IDNA mapping step (UTS #46): it lower-cases the name, applies Unicode normalization, maps certain characters and rejects ones that are not allowed in domain names. This tool does none of that, so a capital letter survives into the output instead of being lower-cased first:

```example
title: no IDNA mapping: case is kept
input: München.de
output: xn--Mnchen-3ya.de
```

A browser would look up `xn--mnchen-3ya.de` for the same name — lower-case and normalize the name first if you need the canonical form.

## Options

- **mode** — `domain` (default, encode label by label with `xn--` prefixing), `label` (treat the whole input as one label) or `raw` (bare bootstring, no prefix).

## Common uses

- Converting an internationalized domain name into the ASCII form that DNS, certificates and older software actually store and transmit.
- Checking the ASCII form of a non-ASCII hostname you were given (lower-case and normalize it first, as described above, to match what a browser looks up).
- Testing IDNA-handling code against known Punycode conversions.
- Encoding non-domain Unicode text with the underlying bootstring algorithm, via raw mode.

## Tips and pitfalls

- Punycode is a reversible encoding, not compression or obfuscation — anyone can decode it straight back to the original text with [punycode decode](/util/punycode_decode/), and it provides no security or privacy benefit.
- A label that already starts with `xn--` but still contains non-ASCII characters is rejected rather than double-encoded, since that combination should never occur in valid IDNA input.
- Unpaired surrogates (malformed input from a broken string, not a real character) are rejected outright: encoding one would produce Punycode that this tool's own decoder refuses to read back.
- Because encoding works per label, labels that are already ASCII — including ones already in `xn--` form — pass through unchanged, so a domain that mixes encoded and plain labels still comes out fully ASCII: `xn--bcher-kva.münchen.de` becomes `xn--bcher-kva.xn--mnchen-3ya.de`. Use [punycode decode](/util/punycode_decode/) if you want the all-Unicode form instead.
