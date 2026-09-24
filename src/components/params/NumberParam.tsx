import { invalid, type ControlProps } from './types'

/**
 * Numeric input; `min`/`max`/`step` come from the spec. Clearing the field
 * stores `''` rather than `0` so the pipeline runner can fall back to the
 * declared default instead of silently treating "empty" as zero; that default is the
 * placeholder, so a cleared box says what it means.
 */
export default function NumberParam({ id, spec, value, onChange, error, describedBy }: ControlProps<'number', number | ''>) {
  return (
    <input
      id={id}
      type="number"
      className="field"
      min={spec.min}
      max={spec.max}
      step={spec.step ?? (spec.integer ? 1 : 'any')}
      placeholder={spec.default === undefined ? undefined : String(spec.default)}
      value={value}
      aria-invalid={invalid(error)}
      aria-describedby={describedBy}
      onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
    />
  )
}
