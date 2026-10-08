import Select from '../Select'
import { invalid, type ControlProps } from './types'

/** The shared theme-aware `Select`; it forwards `id`/`aria-*` to the native `<select>`. */
export default function SelectParam({ id, spec, value, onChange, error, describedBy }: ControlProps<'select', string>) {
  return (
    <Select
      id={id}
      value={value}
      onChange={onChange}
      options={spec.options}
      className="h-[30px]"
      aria-invalid={invalid(error)}
      aria-describedby={describedBy}
    />
  )
}
