import React from 'react'
export default function ToolbarButton({ icon:Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) {
  return (
    <button className="px-3 py-2 rounded-xl border bg-white hover:bg-gray-50 inline-flex items-center gap-2"
      onClick={onClick}>
      <Icon size={16} /> <span className="text-sm">{label}</span>
    </button>
  )
}
