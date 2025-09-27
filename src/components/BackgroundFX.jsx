import React from 'react'

export default function BackgroundFX() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* radial spotlight */}
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[820px] rounded-full blur-3xl opacity-40"
           style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgba(99,102,241,.6) 0%, rgba(99,102,241,0) 70%)' }} />
      {/* diagonal ribbon */}
      <div className="absolute -right-40 top-32 h-64 w-[680px] rotate-[-35deg] blur-2xl opacity-30"
           style={{ background: 'linear-gradient(90deg, rgba(236,72,153,.35), rgba(59,130,246,.35))' }} />
      {/* grid */}
      <div className="absolute inset-0 bg-grid" />
    </div>
  )
}
