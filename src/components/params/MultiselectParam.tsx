import type { ControlProps } from './types'

/** Accessible checkbox group (`fieldset`/`legend` names the whole control). */
export default function MultiselectParam({ id, spec, value, onChange, describedBy }: ControlProps<'multiselect', string[]>) {
  // Selections are emitted in option order so equal choices serialise identically;
  // values the spec no longer offers are kept (and flagged by validation) rather than dropped.
  const toggle = (opt: string, checked: boolean) => {
    const next = new Set(value)
    if (checked) next.add(opt)
    else next.delete(opt)
    onChange([...spec.options.filter(o => next.has(o)), ...value.filter(v => !spec.options.includes(v))])
  }

  return (
    <fieldset id={id} className="flex flex-col gap-1 rounded-xl border p-2" aria-describedby={describedBy}>
      <legend className="text-muted px-1">{spec.label}</legend>
      {spec.options.map(opt => (
        <label key={opt} className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={value.includes(opt)} onChange={e => toggle(opt, e.target.checked)} />
          {opt}
        </label>
      ))}
    </fieldset>
  )
}
