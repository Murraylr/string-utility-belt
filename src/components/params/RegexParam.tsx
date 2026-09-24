import { useMemo } from 'react'
import { countMatches, REGEX_MAX_SCAN } from './regexUtils'
import { invalid, type ControlProps } from './types'

export interface RegexParamProps extends ControlProps<'regex', string> {
  /** Current value of the sibling param named by `spec.flagsParam`, if any. */
  flags?: string
  /** The step's live input — enables the match-count preview below the field. */
  sampleInput?: string
}

/** Regex source input, validated live (error comes from the shared `validateParam`)
 * and, given a sample, reporting how many times it matches. */
export default function RegexParam({ id, spec, value, onChange, error, describedBy, flags, sampleInput }: RegexParamProps) {
  const result = useMemo(() => {
    if (error || !sampleInput || !value) return null
    return countMatches(value, flags ?? '', sampleInput)
  }, [value, flags, sampleInput, error])

  const countId = `${id}-count`
  const described = [describedBy, result ? countId : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1">
      <input
        id={id}
        className="field font-mono text-xs"
        placeholder={spec.placeholder}
        spellCheck={false}
        autoComplete="off"
        value={value}
        aria-invalid={invalid(error)}
        aria-describedby={described}
        onChange={e => onChange(e.target.value)}
      />
      {result && (
        <span id={countId} className="text-xs text-muted">
          {result.count}{result.capped ? '+' : ''} match{result.count === 1 ? '' : 'es'} in sample
          {result.truncated ? ` (first ${Math.round(REGEX_MAX_SCAN / 1000)} KB)` : ''}
        </span>
      )}
    </div>
  )
}
