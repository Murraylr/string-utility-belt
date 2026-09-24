import React from 'react';
import { useT } from '@/app/i18n/useT';

type Option = string | { label: string; value?: string } | { label: string; options: Option[] };

type NativeProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'className' | 'children'>;

/**
 * Theme-aware native `<select>`. An empty-string option shows the translated
 * placeholder. Native attributes (`aria-label`, `id`, `disabled`, `title`, …)
 * pass through — give it an accessible name via `aria-label` or a `<label>`.
 */
export default function Select({ value, onChange, options, className, ...rest }: NativeProps & {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  className?: string;
}) {
  const { t } = useT();
  const renderOption = (opt: Option): React.ReactNode => {
    if (typeof opt === 'string') return <option key={opt} value={opt}>{opt || t('select.placeholder')}</option>;
    if ('options' in opt) {
      return <optgroup key={opt.label} label={opt.label}>{opt.options.map(renderOption)}</optgroup>;
    }
    const v = opt.value ?? opt.label;
    return <option key={v} value={v}>{opt.label}</option>;
  };

  return (
    <select
      {...rest}
      // `min-w-0 max-w-full`: a native <select> sizes its closed box to its WIDEST
      // <option> (not just the selected one), which blows out any grid/flex ancestor
      // once the option list has long labels (e.g. the 246-utility picker). Capping
      // width lets the box shrink to its container instead; the browser truncates the
      // displayed text with ellipsis rather than overflowing. A caller's own `max-w-*`
      // is kept instead: Tailwind emits `max-w-full` after `max-w-sm`/`-md`/…, so
      // adding both would silently discard the narrower cap.
      className={`field min-w-0 ${/(^|\s)max-w-/.test(className ?? '') ? '' : 'max-w-full '}${className || ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(renderOption)}
    </select>
  );
}
