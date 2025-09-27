import React from 'react'
export default function BackgroundFX() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10"
    style={{ background: 'radial-gradient(1200px 400px at 30% -10%, rgba(99,102,241,0.15), transparent), radial-gradient(1000px 300px at 80% -10%, rgba(236,72,153,0.12), transparent)'}} />
}
