import type { ControlProps } from './types'

/** Checkbox with a visible on/off state next to it (the field label above names it). */
export default function BooleanParam({ id, value, onChange, describedBy }: ControlProps<'boolean', boolean>) {
  return (
    <div className="flex items-center gap-2">
      <input id={id} type="checkbox" checked={!!value} aria-describedby={describedBy} onChange={e => onChange(e.target.checked)} />
      <span className="text-sm" aria-hidden="true">{value ? 'on' : 'off'}</span>
    </div>
  )
}
