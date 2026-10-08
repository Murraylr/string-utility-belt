import { invalid, type ControlProps } from './types'

/** Plain multi-line text — a second input, a word list, anything longer than one line. */
export default function TextareaParam({ id, spec, value, onChange, error, describedBy }: ControlProps<'textarea', string>) {
  return (
    <textarea
      id={id}
      className="field min-w-0 resize-y bg-canvas font-mono text-[12.5px] leading-[19px]"
      rows={spec.rows ?? 4}
      placeholder={spec.placeholder}
      maxLength={spec.maxLength}
      value={value}
      aria-invalid={invalid(error)}
      aria-describedby={describedBy}
      onChange={e => onChange(e.target.value)}
    />
  )
}
