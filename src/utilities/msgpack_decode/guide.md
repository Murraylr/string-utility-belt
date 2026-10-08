---
title: MessagePack Decoder: Decode MsgPack to JSON Online
description: Decode MessagePack binary to JSON online. See maps, arrays, integers, floats, binary and extension types turned into readable JSON.
---
## What is MessagePack decoding?

MessagePack packs JSON-shaped data (maps, arrays, strings, numbers, booleans and null) into compact binary instead of text. It shows up in Redis payloads, RPC protocols, game networking, and any inter-service message where JSON's text overhead matters. This tool reads MessagePack bytes and reconstructs the JSON value they represent, so you can inspect a captured payload or debug an encoder without writing decoder code. [msgpack encode](/util/msgpack_encode/) does the reverse.

## How it works

Every value in MessagePack begins with a type byte that tells the decoder what kind of value follows and how many more bytes to read for it:

```example
title: decode a two-field map
input: 82a2696401a46e616d65a3416461
input-encoding: hex
output: {
  "id": 1,
  "name": "Ada"
}
```

Reading byte by byte: `82` means "a map with 2 key-value pairs", `a2` means "a 2-byte string" (`id`), `01` is the integer `1`, `a4` means "a 4-byte string" (`name`), and `a3 41 64 61` is the 3-byte string `Ada`. Maps and arrays nest to any depth, and every string is decoded as UTF-8:

```example
title: nil, a boolean and a small array decode to their JSON equivalents
input: 93 c0 c3 93 01 02 03
input-encoding: hex
output: [
  null,
  true,
  [
    1,
    2,
    3
  ]
]
```

64-bit integers that exceed JavaScript's safe integer range (`Number.MAX_SAFE_INTEGER`) are returned as exact decimal strings instead of numbers, so no precision is silently lost:

```example
title: a 64-bit unsigned integer beyond safe range becomes a decimal string
input: cfffffffffffffffff
input-encoding: hex
output: 18446744073709551615
```

MessagePack's extension types carry an application-defined type number and a payload. This tool does not interpret any of them, not even the spec's own timestamp type (`-1`), so they surface as `{ "type": N, "data": "hex" }` rather than being guessed at:

```example
title: an extension type surfaces as { type, data }
input: d40501
input-encoding: hex
output: {
  "type": 5,
  "data": "01"
}
```

## Reading errors

Truncated input (fewer bytes than a value's header promises), the reserved `0xc1` byte, or a string whose bytes are not valid UTF-8 all produce a specific error rather than returning corrupted or partial data. The tool decodes exactly one top-level value, so bytes left over after it (including a stream of several concatenated values) are reported as trailing data. Empty input decodes to empty output rather than an error.

## Common uses

- Inspecting a MessagePack payload captured from a cache entry, a WebSocket frame, or an RPC call.
- Debugging a custom MessagePack encoder by checking that its bytes decode to the value you expected.
- Converting logged or dumped binary data back into readable JSON.

## Tips and pitfalls

- This step reads raw bytes. Typed text is taken as its UTF-8 bytes, not parsed as hex, so to decode a hex dump put [hex decode](/util/hex_decode/) in front of it.
- `bin` values come back as raw bytes. Map keys that are not strings are turned into strings: numbers and booleans as written, `bin` keys as hex.
- A map key of `__proto__` is decoded as an ordinary object key rather than being dropped or used to change the object's prototype.
- For a schema-based binary format instead of a schemaless one, see [protobuf wire decode](/util/protobuf_decode/), which decodes Protocol Buffers wire data.
