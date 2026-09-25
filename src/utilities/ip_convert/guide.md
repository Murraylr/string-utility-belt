---
title: IP Address Converter — Integer, Hex and Binary Online
description: Convert IPv4 and IPv6 addresses between integer, hexadecimal, binary and dotted forms, and expand or compress IPv6 addresses online.
---
## Why convert an IP address's form?

An IP address is really just a number — 32 bits for IPv4, 128 for IPv6 — and different tools expect it written differently: dotted-quad text for humans, a plain integer in a database column, hex in a router config, or fully expanded IPv6 groups instead of the shorthand `::`. This tool converts between all of those forms, auto-detecting which direction you need by default.

## How it works

With no `mode` set (or `auto`), the tool looks at what you pasted and picks the sensible conversion. A dotted address becomes its integer value:

```example
title: dotted address to integer (auto)
input: 192.168.1.1
output: 3232235777
```

An integer becomes a dotted address:

```example
title: integer back to a dotted address (auto)
input: 3232235777
output: 192.168.1.1
```

IPv6 auto-detection works the same way in reverse: shorthand with `::` expands to eight full groups, and an already-expanded address compresses back down, following RFC 5952's canonical rules (the longest run of zero groups collapses; if two runs tie for longest, the first one wins; a single lone zero group is never collapsed):

```example
title: compress a fully expanded IPv6 address
input: 2001:0db8:0000:0000:0000:0000:0000:0001
params: {"mode": "ipv6-compress"}
output: 2001:db8::1
```

Set `mode` explicitly to skip auto-detection and always convert one specific way, including mapping an IPv4 address into its IPv6-mapped form:

```example
title: map an IPv4 address into IPv6
input: 192.168.1.1
params: {"mode": "ipv4-to-ipv6"}
output: ::ffff:192.168.1.1
```

Binary and hex renderings are available for both address families. Binary shows IPv4 as four dot-separated 8-bit groups and IPv6 as eight colon-separated 16-bit groups; hex is a single `0x`-prefixed number, 8 digits for IPv4 and 32 for IPv6:

```example
title: render an IPv4 address in binary
input: 192.168.1.1
params: {"mode": "to-binary"}
output: 11000000.10101000.00000001.00000001
```

The `to-binary`, `to-hex` and `ipv4-to-ipv6` modes accept an integer in place of an address; `to-integer` and the IPv6 modes need a textual address, and `to-address` needs a number. Wherever a number is read, `0x`-prefixed hex, `0b`-prefixed binary, and decimal digits grouped with underscores (`3_232_235_777`) or commas (`3,232,235,777`) all work.

## Options

- **mode** — `auto` (default, detects the direction), `to-integer`, `to-address`, `ipv6-expand`, `ipv6-compress`, `to-binary`, `to-hex`, or `ipv4-to-ipv6`.
- **per line** — on by default, converting each line of the input independently. When off, the whole (trimmed) input is treated as a single value.

## Common uses

- Storing IP addresses as integers in a database and converting them back for display.
- Normalizing IPv6 addresses to a canonical compressed or fully expanded form for comparison or logging.
- Converting an address stored as a `0x…` hex or `0b…` binary number back into dotted notation.
- Building an IPv4-mapped IPv6 address (`::ffff:a.b.c.d`) for dual-stack configuration.

## Tips and pitfalls

- An IPv4 octet with a leading zero (`010.0.0.1`) is rejected rather than read as decimal 10 — historically `inet_aton` treats a leading zero as octal, making `010` mean 8, so accepting it as decimal would silently misparse real-world addresses.
- `ipv6-expand` and `ipv6-compress` each require an address of the matching family; feeding an IPv4 address to either throws a clear error rather than guessing.
- An integer larger than `2^128 - 1` (too big for even an IPv6 address) or negative throws instead of wrapping or truncating.
- To inspect a whole network rather than a single address — network/broadcast address, usable host count, subnet splitting — use [cidr tools](/util/cidr/); for converting integers to other numeric bases in general, see [number base convert](/util/number_base_convert/).
