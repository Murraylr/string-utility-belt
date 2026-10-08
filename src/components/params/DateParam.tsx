import { invalid, type ControlProps } from './types'

const DATE = /^\d{4}-\d{2}-\d{2}/
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?))?/

/**
 * The part of an ISO value the native input can show: a date input rejects anything
 * with a time, and datetime-local rejects a zone suffix or a bare date — either would
 * make a perfectly valid stored value render as an empty box.
 */
function toInputValue(value: string, withTime: boolean): string {
  if (!withTime) return DATE.exec(value)?.[0] ?? value
  const m = DATE_TIME.exec(value)
  return m ? `${m[1]}T${m[2] ?? '00:00'}` : value
}

/** `type=date`, or `datetime-local` when the spec asks for a time component too. */
export default function DateParam({ id, spec, value, onChange, error, describedBy }: ControlProps<'date', string>) {
  return (
    <input
      id={id}
      type={spec.withTime ? 'datetime-local' : 'date'}
      className="field h-[30px] min-w-0"
      value={toInputValue(value, !!spec.withTime)}
      aria-invalid={invalid(error)}
      aria-describedby={describedBy}
      onChange={e => onChange(e.target.value)}
    />
  )
}
