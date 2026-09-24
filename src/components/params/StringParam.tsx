import { invalid, type ControlProps } from './types'

/** Single-line text input: `placeholder` and `maxLength` come straight from the spec. */
export default function StringParam({ id, spec, value, onChange, error, describedBy }: ControlProps<'string', string>) {
  return (
    <input
      id={id}
      className="field"
      placeholder={spec.placeholder}
      maxLength={spec.maxLength}
      value={value}
      aria-invalid={invalid(error)}
      aria-describedby={describedBy}
      onChange={e => onChange(e.target.value)}
    />
  )
}
