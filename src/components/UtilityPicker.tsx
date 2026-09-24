import React from 'react'
import { BookOpen } from 'lucide-react'
import { UTIL_DISPLAY, CATEGORIES, docsHref } from '@/utilities'

export default function UtilityPicker({ onPick }: { onPick: (id: string) => void }) {
  const cats = CATEGORIES.filter(c => c !== 'All')
  return (
    <div className="card p-4">
      <div className="text-sm text-gray-500 mb-2">Browse utilities</div>
      <div className="grid md:grid-cols-3 gap-3">
        {cats.map(cat => (
          <div key={cat}>
            <div className="text-xs font-semibold mb-2">{cat}</div>
            <div className="grid gap-2">
              {UTIL_DISPLAY.filter(u => u.category === cat).map(u => (
                <div key={u.id} className="relative">
                  <button className="w-full text-left p-2 pr-14 rounded-lg border hover:bg-gray-50"
                    onClick={()=>onPick(u.id)}>
                    <div className="text-sm">{u.name}</div>
                    <div className="text-xs text-gray-500">{u.description}</div>
                  </button>
                  <a href={docsHref(u.id)} aria-label={`${u.name} docs`}
                    className="absolute top-2 right-2 inline-flex items-center gap-1 text-xs text-gray-500 hover:text-primary-600 hover:underline">
                    <BookOpen size={12}/> docs
                  </a>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
