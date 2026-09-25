---
title: Protobuf Decoder — Decode Protobuf Wire Format Online
description: Decode Protocol Buffers wire format online without a .proto schema, like protoc --decode_raw. See every field number, wire type and value.
---
## What is protobuf wire decoding?

Protocol Buffers (protobuf) is a binary serialization format that normally needs a `.proto` schema to interpret: the schema is what tells a real decoder that field 2 is called `name` and is a string. When you only have the raw bytes — captured from a gRPC call, pulled out of a log, or found in a binary file — and no schema, this tool walks the wire format directly and reports each field's number, wire type and value, much like the `protoc --decode_raw` command-line tool (which prints protobuf text format rather than JSON).

## How it works

Protobuf's wire format is a flat sequence of fields, each starting with a varint "tag" that packs together a field number and a wire type:

```example
title: a varint field and a length-delimited (string) field
input: 089601120568656c6c6f
input-encoding: hex
output: [
  {
    "field": 1,
    "wireType": 0,
    "value": 150
  },
  {
    "field": 2,
    "wireType": 2,
    "value": "hello"
  }
]
```

There are four wire types this tool resolves: `0` is a varint (used for ints, bools and enums), `1` is a fixed 8-byte value (used for `double`/`fixed64`/`sfixed64` — all three interpretations are shown), `2` is length-delimited (strings, bytes, or embedded messages), and `5` is a fixed 4-byte value (`float`/`fixed32`/`sfixed32`). A deprecated wire type `3`/`4` group is also supported.

A length-delimited field (wire type 2) is inherently ambiguous — the same bytes could be a string or a nested message — so this tool guesses using a practical heuristic: if the bytes decode as printable UTF-8 text, it is shown as a string; otherwise it tries parsing them as a nested message, and falls back to hex if that also fails:

```example
title: a length-delimited field that is itself a nested message
input: 1a03089601
input-encoding: hex
output: [
  {
    "field": 3,
    "wireType": 2,
    "value": [
      {
        "field": 1,
        "wireType": 0,
        "value": 150
      }
    ]
  }
]
```

```example
title: non-printable bytes fall back to hex
input: 0a02fffe
input-encoding: hex
output: [
  {
    "field": 1,
    "wireType": 2,
    "value": "fffe"
  }
]
```

## Input handling

Input can be raw bytes, or a string. A string made only of hex digits (spaces allowed, even length) is read as hex; anything else is read as base64 or base64url. Hex wins when both fit, so a short base64 string such as `CAFE` is taken as the two hex bytes `ca fe`. Empty input decodes to an empty list rather than an error.

## Field numbers and errors

A valid field number is between 1 and 2^29 − 1; the special range 19,000–19,999 is reserved by protobuf itself, though this tool does not enforce that reservation, only the outer bounds. Malformed input — a truncated varint, an invalid wire type, a length-delimited field whose declared length runs past the end of the buffer, or a 64-bit varint that overflows — raises a specific error rather than returning corrupted data.

## Common uses

- Inspecting a gRPC request or response captured from a proxy or packet trace when you do not have the `.proto` file.
- Debugging a hand-written protobuf encoder by comparing its byte output field by field.
- Reverse-engineering an undocumented protobuf-based API.

## Tips and pitfalls

- Without a schema, field names are never available — only numbers. If you do have the `.proto` file, a real protobuf decoder will give you far more useful field names and types than this tool ever can.
- A short byte string, like `hi`, can accidentally also parse as a well-formed (nonsense) nested message; this tool prefers the text interpretation whenever the bytes are fully printable UTF-8. That is right for most payloads, but a nested message whose bytes all happen to be printable is shown as a string.
- Varints are shown as raw unsigned numbers. A negative `int32`/`int64` is encoded as a 10-byte varint, so `-1` shows as `"18446744073709551615"`, and `sint32`/`sint64` zigzag values are not undone (`-1` shows as `1`, `1` as `2`).
- Packed repeated fields (`repeated int32` and similar in proto3) are one length-delimited field holding back-to-back varints, so they show up as hex (`"010203"` for `[1, 2, 3]`) or, occasionally, misread as a string or a nested message.
- For a schemaless binary format that is unambiguous by design, compare with [msgpack decode](/util/msgpack_decode/).
