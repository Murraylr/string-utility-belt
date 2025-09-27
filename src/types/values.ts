export type Value = string | Uint8Array;
export type Accepts = Array<'string' | 'bytes'>;
export type Produces = Accepts;

export function isBytes(v: Value): v is Uint8Array {
  return typeof v !== 'string';
}
export function isString(v: Value): v is string {
  return typeof v === 'string';
}
