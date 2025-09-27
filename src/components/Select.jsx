export default function Select({ value, onChange, options, className }) {
  /**
   * options can be:
   * - string[]                        -> flat <option>
   * - { label: string, value: any }[] -> flat with labels
   * - { label: string, options: [...] }[] -> groups rendered as <optgroup>
   */
  const renderOption = (opt) => {
    if (typeof opt === 'string') {
      return <option key={opt} value={opt}>{opt || '— select —'}</option>
    }
    if (opt && Array.isArray(opt.options)) {
      // group
      return (
        <optgroup key={opt.label} label={opt.label}>
          {opt.options.map(renderOption)}
        </optgroup>
      )
    }
    // labeled
    return <option key={opt.value ?? opt.label} value={opt.value ?? opt.label}>{opt.label}</option>
  }

  return (
    <select
      className={`border rounded-xl px-3 py-2 bg-white shadow-soft ${className || ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(renderOption)}
    </select>
  )
}
