import React from 'react'

export default function ToolbarButton({ icon: Icon, label, onClick, disabled }: { icon: any; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn h-[30px] px-2.5"
    >
      <Icon size={14} aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}
