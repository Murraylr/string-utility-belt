import { invalid, type ControlProps } from './types'

/** Slider with a numeric readout; `aria-valuetext` announces the current value. */
export default function RangeParam({ id, spec, value, onChange, error, describedBy }: ControlProps<'range', number>) {
  return (
    <div className="flex items-center gap-2">
      <input
        id={id}
        type="range"
        className="flex-1"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        aria-valuetext={String(value)}
        aria-invalid={invalid(error)}
        aria-describedby={describedBy}
        onChange={e => onChange(Number(e.target.value))}
      />
      <output htmlFor={id} className="min-w-[2.5rem] text-right text-xs tabular-nums" aria-hidden="true">{value}</output>
    </div>
  )
}
