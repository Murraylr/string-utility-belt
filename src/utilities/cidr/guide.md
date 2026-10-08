---
title: CIDR Calculator: Subnet and IP Range Tool Online
description: Inspect an IPv4 or IPv6 CIDR block online: network and broadcast address, usable hosts, subnet mask, private-range check, and subnet splitting.
---
## What is CIDR notation?

CIDR (Classless Inter-Domain Routing) writes an IP network as an address plus a prefix length, like `192.168.1.0/24`: the prefix says how many leading bits are fixed for the network, leaving the rest free for hosts. A `/24` IPv4 block has 8 host bits (256 addresses); a `/30` has 2 host bits (4 addresses). This tool takes a CIDR block (or a bare address, treated as a single host) and reports its network details, lists its addresses, checks whether another address falls inside it, or splits it into smaller subnets.

## How it works

The default mode reports everything about the block: its network and broadcast address, the first and last *usable* host, the subnet mask and wildcard mask, and how many total and usable addresses it holds:

```example
title: ipv4 network info
input: 192.168.1.0/24
params: {"mode": "info"}
output:
{
  "network": "192.168.1.0",
  "broadcast": "192.168.1.255",
  "firstHost": "192.168.1.1",
  "lastHost": "192.168.1.254",
  "netmask": "255.255.255.0",
  "wildcard": "0.0.0.255",
  "prefix": 24,
  "totalHosts": 256,
  "usableHosts": 254,
  "isPrivate": true,
  "version": 4
}
```

"Usable" hosts excludes the network and broadcast address for ordinary IPv4 blocks, with two RFC-defined exceptions this tool honors: a `/31` is a point-to-point link (RFC 3021) where both addresses are usable, and a `/32` is a single host where the one address is usable. IPv6 has no broadcast address: for an IPv6 block the `broadcast` field is simply the last address, and every address counts as usable. `isPrivate` flags any block that sits entirely inside a non-globally-routable range: RFC 1918 private space, loopback, link-local, RFC 6598 carrier-grade NAT, the documentation and benchmarking ranges, and their IPv6 equivalents (unique local, link-local, the `2001:db8::/32` documentation range, and more).

`expand` mode lists every address in the block, one per line, capped by `limit` so a huge block can't lock up the page:

```example
title: expand every address in a small block
input: 10.0.0.0/30
params: {"mode": "expand", "limit": 8}
output: 10.0.0.0
10.0.0.1
10.0.0.2
10.0.0.3
```

```example
title: a limit lower than the block size adds a note
input: 192.168.1.0/30
params: {"mode": "expand", "limit": 2}
output: 192.168.1.0
192.168.1.1
... 2 more (raise limit)
```

`contains` mode checks whether an address (or a smaller sub-block) falls inside the given block:

```example
title: does the block contain this address?
input: 10.0.0.0/24
params: {"mode": "contains", "address": "10.0.0.5"}
output:
{
  "cidr": "10.0.0.0/24",
  "address": "10.0.0.5",
  "contains": true,
  "version": 4
}
```

`split` mode divides the block into every subnet of a longer prefix you name in `newPrefix`:

```example
title: split a /24 into four /26 subnets
input: 192.168.0.0/24
params: {"mode": "split", "newPrefix": 26}
output: 192.168.0.0/26
192.168.0.64/26
192.168.0.128/26
192.168.0.192/26
```

The same modes work for IPv6; addresses are rendered in their canonical compressed form (RFC 5952), and counts too large to fit a JavaScript number (an entire `/64`, for instance) are reported as exact decimal strings instead of losing precision.

## Options

- **mode**: `info` (default), `expand`, `contains` or `split`.
- **address (contains)**: the address or sub-block to test in `contains` mode.
- **new prefix (split)**: the longer prefix length to split into, in `split` mode; must be longer than the block's own prefix.
- **max rows**: caps how many lines (addresses or subnets) `expand` and `split` list before appending a "… more" note; defaults to 1024, capped at 100,000.

## Common uses

- Working out how many usable hosts a subnet plan actually gives you before provisioning it.
- Checking whether a specific IP falls inside a firewall rule's or VPC route's CIDR block.
- Breaking a larger allocation into equal-sized subnets for VLSM planning.
- Confirming an address is (or isn't) in private, non-routable space before treating it as a public IP.

## Tips and pitfalls

- A bare address with no `/prefix` is treated as a single host (`/32` for IPv4, `/128` for IPv6). That is useful for `contains` checks against one specific IP.
- A block that only partly overlaps a private range (`172.0.0.0/11`, which spans outside RFC 1918's `172.16.0.0/12`) is not flagged private; the whole block must sit inside a special-purpose range.
- Malformed CIDR text (an out-of-range prefix, a non-numeric prefix, or an invalid address) throws a clear error rather than returning a partial result.
- For converting the addresses themselves between integer, hex and binary forms, see [ip convert](/util/ip_convert/).
