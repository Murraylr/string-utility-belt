export type ValueType = 'string' | 'bytes' | 'json';
export type Produces = ValueType;
export type Accepts = ValueType | ValueType[];

export type Value = string | Uint8Array | Record<string, unknown>;

export type ParamSpec =
  | { kind: 'string'; label: string; default?: string; placeholder?: string }
  | { kind: 'number'; label: string; default?: number }
  | { kind: 'boolean'; label: string; default?: boolean }
  | { kind: 'select'; label: string; options: string[]; default?: string };

export type Params = Record<string, unknown>;

export interface Utility {
  id: string;
  name: string;
  category: string;
  description?: string;
  accepts?: Accepts;
  produces?: Produces;
  params: Record<string, ParamSpec>;
  apply(input: Value, params: Params): Promise<Value> | Value;
}
