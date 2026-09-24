import React from 'react'

export default function ToolbarButton({ icon: Icon, label, onClick, disabled }: { icon: any; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn"
    >
      <Icon size={16} aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </button>
  )
}
