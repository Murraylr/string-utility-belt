import type { ControlProps } from './types'

/** A checkbox; ParamsEditor puts its label right after it. */
export default function BooleanParam({ id, value, onChange, describedBy }: ControlProps<'boolean', boolean>) {
  return <input id={id} type="checkbox" className="cursor-pointer" checked={!!value} aria-describedby={describedBy} onChange={e => onChange(e.target.checked)} />
}
