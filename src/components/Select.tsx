import React from 'react';

type Option = string | { label: string; value?: string } | { label: string; options: Option[] };

export default function Select({ value, onChange, options, className }: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  className?: string;
}) {
  const renderOption = (opt: Option): React.ReactNode => {
    if (typeof opt === 'string') return <option key={opt} value={opt}>{opt || '— select —'}</option>;
    if ('options' in opt && Array.isArray(opt.options)) {
      return <optgroup key={opt.label} label={opt.label}>{opt.options.map(renderOption)}</optgroup>;
    }
    const v = (opt.value ?? opt.label) as string;
    return <option key={v} value={v}>{opt.label}</option>;
  };

  return (
    <select
      className={`border rounded-xl px-3 py-2 bg-white shadow-soft ${className || ''}`}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      {options.map(renderOption)}
    </select>
  );
}
