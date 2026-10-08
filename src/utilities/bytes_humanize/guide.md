---
title: Byte Size Converter: Humanize or Parse File Sizes
description: Convert byte counts to readable sizes like 1.50 GiB and back again online, with binary or decimal units and exact BigInt precision.
---
## What does "humanizing" bytes mean?

A raw byte count like `1610612736` is accurate but unreadable at a glance; "1.50 GiB" says the same
thing in a form people actually parse quickly. This tool converts in both directions: turning byte
counts into readable sizes, and parsing sizes like "10 MB" or "1.5 GiB" back into an exact byte count.
It understands both major unit systems, which disagree with each other by design.

## How it works

Set **direction** to `to-human` (default) or `to-bytes`. The **unit** option chooses which system
governs the conversion: `binary` (default) uses powers of 1024 with IEC units (KiB, MiB, GiB, and so
on), while `decimal` uses powers of 1000 with SI units (kB, MB, GB). The gap grows with each prefix:
about 2.4% at kilo, 4.9% at mega, 7.4% at giga and 10% at tera, which is exactly why a drive sold as
"1 TB" (decimal) shows up as roughly 931 GiB in an operating system that counts in binary.

```example
title: bytes to a readable binary size
input: 1536
params: {"direction": "to-human", "unit": "binary"}
output: 1.50 KiB
```

```example
title: a human size back to an exact byte count
input: 1.5 GiB
params: {"direction": "to-bytes"}
output: 1610612736
```

Decimal units follow powers of 1000 instead, so the same byte count reads differently:

```example
title: the decimal (SI) unit system uses powers of 1000
input: 1500000
params: {"unit": "decimal"}
output: 1.50 MB
```

Parsing accepts more than a bare number: grouped digits (`1,048,576`), a European decimal comma,
spelled-out units (`gigabytes`, `gibibytes`), and negative sizes all work. An IEC unit like `GiB` or
`gibibytes` always means powers of 1024, even if **unit** is set to `decimal`, because it says
explicitly what it means. SI-style units do not: `MB`, `kB` or `megabytes` follow the **unit**
option, so with the default `binary` setting `10 MB` parses as 10 × 1024² = 10485760 bytes. Switch
**unit** to `decimal` to read it as 10000000. In `to-bytes` mode very large sizes stay exact, because
the conversion is done with arbitrary-precision integers, not floating-point math:

```example
title: exact conversion of huge sizes, no floating-point drift
input: 1 YiB
params: {"direction": "to-bytes"}
output: 1208925819614629174706176
```

## Options

- **direction**: `to-human` (default) converts a byte count to a readable size; `to-bytes` parses a
  readable size back into an exact byte count.
- **unit**: `binary` (default, powers of 1024, IEC units) or `decimal` (powers of 1000, SI units).
  An explicit IEC suffix in the input (`KiB`, `kibibytes`, …) always means 1024-based, regardless of
  this setting; SI-style suffixes (`kB`, `MB`, …) are read with whichever base this option selects.
- **decimals**: 0–20 decimal places shown in `to-human` output, default 2. Whole bytes (under 1
  KiB/kB) never show a decimal point.
- **per line**: on by default; converts each line independently. Turn it off to treat the whole input
  as a single value.

## Common uses

- Displaying a file, upload, or download size in a UI without hand-rolling the KiB/MiB/GiB math.
- Converting a human-entered size ("500 MB max upload") into the exact byte limit a config file or API
  expects: 524288000 with the default binary units, 500000000 with **unit** set to `decimal`.
- Reconciling a size a vendor quotes in decimal GB with what an OS reports in binary GiB for the same
  drive or file.
- Batch-converting a list of byte counts (log output, a spreadsheet column) into readable sizes with
  **per line** on.

## Tips and pitfalls

An unrecognized unit (a typo, or a unit this tool does not know) produces a clear "unknown size
unit" error rather than a silently wrong number; check the spelling of the suffix if `to-bytes`
rejects an otherwise reasonable-looking size. Rounding in `to-human` mode can carry a value into the
next unit: 1,048,575 bytes at 2 decimal places rounds up to "1.00 MiB" rather than "1024.00 KiB",
because the displayed value would otherwise round to a number equal to or larger than the next unit's
threshold. For converting numbers that are not byte sizes (plain thousands separators, percentages,
currency), see [number format](/util/number_format/) instead; for converting the byte count itself
between number bases, see [number base convert](/util/number_base_convert/).
