import React, { useMemo, useState } from 'react'
import { CATEGORIES, getUtilitiesByCategory } from '@/utilities'
import { Search, Plus } from 'lucide-react'

export default function UtilityPicker({ onPick }) {
  const [category, setCategory] = useState('All')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const items = getUtilitiesByCategory(category)
    const needle = q.trim().toLowerCase()
    if (!needle) return items
    return items.filter(u =>
      u.name.toLowerCase().includes(needle) ||
      u.id.toLowerCase().includes(needle) ||
      (u.description || '').toLowerCase().includes(needle)
    )
  }, [category, q])

  return (
    <div className="card p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${category === c ? 'bg-primary-600 text-white border-primary-600 shadow-glow' : 'bg-white hover:bg-gray-50'}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="relative mb-4">
        <input
          className="w-full border rounded-xl pl-9 pr-3 py-2 outline-none focus:ring bg-white shadow-soft"
          placeholder="Search utilities…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <Search className="absolute left-2 top-1/2 -translate-y-1/2" size={16} />
      </div>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map(u => (
          <li key={u.id}>
            <button
              onClick={() => onPick(u.id)}
              className="w-full h-full text-left p-4 rounded-2xl border bg-white hover:border-primary-600 hover:shadow-glow transition"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium">{u.name}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full border bg-gray-50">{u.category}</span>
              </div>
              <div className="text-xs text-gray-600">{u.description}</div>
              <div className="mt-3 flex flex-wrap gap-1">
                {Object.entries(u.params || {}).slice(0,3).map(([k]) => (
                  <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 border">{k}</span>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2 text-primary-600 text-sm">
                <Plus size={14}/> add
              </div>
            </button>
          </li>
        ))}
        {list.length === 0 && <li className="text-sm text-gray-500">No utilities match your search.</li>}
      </ul>
    </div>
  )
}
