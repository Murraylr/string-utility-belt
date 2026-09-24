import type { ParamSpec } from '@/types/utility'

export type SpecOf<K extends ParamSpec['kind']> = Extract<ParamSpec, { kind: K }>

/** What ParamsEditor hands every control. */
export interface ControlProps<K extends ParamSpec['kind'], V> {
  id: string
  spec: SpecOf<K>
  value: V
  onChange: (value: V) => void
  /** Validation message; the control only uses it for `aria-invalid`. */
  error?: string | null
  /** Space-separated ids of the help text and error message under the control. */
  describedBy?: string
}

/** `aria-invalid` value for a control: present only while there is an error. */
export const invalid = (error?: string | null) => (error ? true : undefined)

/** Any param value as display text — share links and old storage can hold anything. */
export function asText(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === undefined || v === null) return ''
  if (typeof v === 'object') {
    try { return JSON.stringify(v) ?? '' } catch { return String(v) }
  }
  return String(v)
}
