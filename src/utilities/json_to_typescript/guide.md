---
title: JSON to TypeScript: Generate Interfaces from JSON
description: Infer TypeScript interfaces or type aliases from a JSON sample online, with optional nullable-as-optional properties, readonly fields and union types.
---
## What is JSON to TypeScript type generation?

When you have a sample JSON payload (an API response, a config file, a fixture) but no schema for it, writing the matching TypeScript types by hand is tedious and easy to get subtly wrong. This tool inspects the shape of a JSON value and generates TypeScript `interface` or `type` declarations that describe it: property names, primitive types, nested object types (each pulled out into its own named declaration), and array element types.

## How it works

The generator walks the JSON value once, recording the type of every property it sees, then emits one declaration for the root and one for each nested object:

```example
title: infer an interface from a sample
input: {"id":1,"name":"Ada","tags":["core","dev"],"active":true}
output: export interface Root {
  id: number;
  name: string;
  tags: string[];
  active: boolean;
}
```

A nested object becomes its own named interface, named after the property key that held it (converted to PascalCase), and referenced from the parent:

```example
title: a nested object becomes its own interface
input: {"id":1,"address":{"city":"London","zip":null}}
output: export interface Root {
  id: number;
  address: Address;
}

export interface Address {
  city: string;
  zip?: null;
}
```

When the sample array contains objects with different keys, the generator merges them into a single shape: a key missing from some entries becomes optional rather than being silently dropped or forcing every entry to match the first one seen.

```example
title: array items with different keys merge, missing keys become optional
params: {"rootName": "Users"}
input: [{"id":1,"email":"a@b.co"},{"id":2}]
output: export type Users = User[];

export interface User {
  id: number;
  email?: string;
}
```

A mixed-type array such as `[1, "two", true]` either becomes a union of every member type seen, or widens to `unknown`. The generator never narrows to just the first value, since that would produce a type that lies about the rest of the sample:

```example
title: a mixed array becomes a union, or widens to unknown
params: {"arrayUnion": false}
input: {"mixed":[1,"two",true]}
output: export interface Root {
  mixed: unknown[];
}
```

## Options

- **root name**: the name given to the top-level declaration. Defaults to `Root`. When the root is an array, its item interface takes the singular form (`Users` → `User`, `categories` → `Category`), or `RootItem` when the name has no singular. Nested objects are named after their property keys, not the root name.
- **style**: `interface` (the default) emits `export interface Name { ... }`; `type` emits `export type Name = { ... };`.
- **nulls optional**: when on (the default), a property whose only observed value is `null`, or that can be `null` among other types, is marked optional (`prop?:`) with `null` removed from its type where possible. When off, `null` stays as a literal member of the type and the property stays required.
- **readonly props**: prefixes every property with `readonly` when on. Off by default.
- **union mixed arrays**: when on (the default), an array whose items have different types becomes a union type, such as `(number | string)[]`. When off, a genuinely mixed array widens to `unknown[]` instead of guessing from the first element, and so does a property whose type differs between merged array items (`a: unknown`).

## Common uses

- Bootstrapping types for a third-party API response before writing a proper client.
- Turning a test fixture or a config file sample into a starting-point interface to refine by hand.
- Quickly checking what shape a deeply nested JSON blob actually has.

## Tips and pitfalls

- Object keys that are not valid TypeScript identifiers (`'my-key'`, `'🚀'`) are automatically quoted in the output.
- Keys that map to the same PascalCase name (`user` and `User`) share one interface when their shapes are identical; with different shapes the second gets a numeric suffix (`User`, `User2`). Identical shapes under differently named keys (`home`, `work`) still get separate interfaces (`Home`, `Work`).
- This generates types from one sample, not a guarantee. A field that is always a string in your sample but occasionally `number` or missing in production will not be caught. For validating data against a schema you already trust, see [json schema validate](/util/json_schema_validate/); to look at the raw structure first, use [json pretty](/util/json_pretty/).
