import React from 'react'
import type { ParamSpec } from '@/types/utility'

type Props = {
  spec: Record<string, ParamSpec>,
  params: Record<string, any>,
  onChange: (next: Record<string, any>) => void
}

export default function ParamsEditor({ spec, params, onChange }: Props) {
  const set = (k: string, v: any) => onChange({ ...params, [k]: v })

  return (
    <div className="grid md:grid-cols-2 gap-3">
      {Object.entries(spec || {}).map(([k, s]) => {
        if (s.kind === 'string') {
          return (
            <label key={k} className="grid gap-1">
              <span className="text-xs text-gray-500">{s.label}</span>
              <input className="border rounded-xl px-3 py-2" value={params[k] ?? s.default ?? ''}
                placeholder={s.placeholder || ''} onChange={e=>set(k, e.target.value)} />
            </label>
          )
        }
        if (s.kind === 'number') {
          return (
            <label key={k} className="grid gap-1">
              <span className="text-xs text-gray-500">{s.label}</span>
              <input type="number" className="border rounded-xl px-3 py-2" value={params[k] ?? s.default ?? 0}
                onChange={e=>set(k, e.target.valueAsNumber)} />
            </label>
          )
        }
        if (s.kind === 'boolean') {
          return (
            <label key={k} className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={!!(params[k] ?? s.default ?? false)} onChange={e=>set(k, e.target.checked)} />
              {s.label}
            </label>
          )
        }
        if (s.kind === 'select') {
          return (
            <label key={k} className="grid gap-1">
              <span className="text-xs text-gray-500">{s.label}</span>
              <select className="border rounded-xl px-3 py-2" value={params[k] ?? s.default ?? ''}
                onChange={e=>set(k, e.target.value)}>
                {s.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          )
        }
        return null
      })}
    </div>
  )
}
