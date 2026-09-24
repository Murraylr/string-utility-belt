import React from 'react'
import { ArrowLeft } from 'lucide-react'
import { UTIL_MAP, UTIL_DISPLAY, CATEGORIES, docsHref } from '@/utilities'
import type { ParamSpec } from '@/types/utility'

const fmtTypes = (t: unknown) => Array.isArray(t) ? t.join(', ') : String(t ?? 'string')

function fmtDefault(spec: ParamSpec) {
  if (!('default' in spec) || spec.default === undefined) return '—'
  return spec.default === '' ? '(empty)' : String(spec.default)
}

export function DocsIndex() {
  const cats = CATEGORIES.filter(c => c !== 'All')
  return (
    <div className="card p-6 grid gap-6">
      <h1 className="text-2xl font-semibold">Utility docs</h1>
      {cats.map(cat => (
        <section key={cat}>
          <h2 className="text-xs font-semibold mb-2">{cat}</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {UTIL_DISPLAY.filter(u => u.category === cat).map(u => (
              <li key={u.id}>
                <a href={docsHref(u.id)} className="block p-3 rounded-xl border bg-white hover:border-primary-600 transition">
                  <div className="text-sm font-medium">{u.name}</div>
                  <div className="text-xs text-gray-500">{u.description}</div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default function UtilityDoc({ id }: { id: string }) {
  const util = UTIL_MAP[id]
  const back = (
    <div className="flex gap-4 text-sm">
      <a href="#/" className="inline-flex items-center gap-1 hover:underline"><ArrowLeft size={14}/> back to tool</a>
      <a href="#/docs" className="hover:underline">all utilities</a>
    </div>
  )
  if (!util) {
    return (
      <div className="card p-6 grid gap-3">
        {back}
        <div className="text-red-600">Utility “{id}” not found.</div>
      </div>
    )
  }
  const params = Object.entries(util.params || {})
  return (
    <article className="card p-6 grid gap-5">
      {back}
      <header className="grid gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{util.name}</h1>
          <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50">{util.category || 'Other'}</span>
        </div>
        {util.description && <p className="text-gray-700">{util.description}</p>}
      </header>
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-gray-500">id</dt><dd className="mono">{util.id}</dd>
        <dt className="text-gray-500">accepts</dt><dd className="mono">{fmtTypes(util.accepts)}</dd>
        <dt className="text-gray-500">produces</dt><dd className="mono">{fmtTypes(util.produces)}</dd>
      </dl>
      <section>
        <h2 className="font-semibold mb-2">Parameters</h2>
        {params.length === 0 ? (
          <p className="muted">This utility takes no parameters.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-1 pr-4">name</th><th className="py-1 pr-4">type</th>
                  <th className="py-1 pr-4">label</th><th className="py-1 pr-4">default</th><th className="py-1">options</th>
                </tr>
              </thead>
              <tbody>
                {params.map(([key, spec]) => (
                  <tr key={key} className="border-b last:border-0">
                    <td className="py-1 pr-4 mono">{key}</td>
                    <td className="py-1 pr-4">{spec.kind}</td>
                    <td className="py-1 pr-4">{spec.label}</td>
                    <td className="py-1 pr-4 mono">{fmtDefault(spec)}</td>
                    <td className="py-1 mono">{spec.kind === 'select' ? spec.options.join(', ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </article>
  )
}
