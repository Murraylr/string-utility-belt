import React from 'react'

/**
 * Decorative ambient gradients + grid behind the app. Purely visual (no
 * pointer events, hidden from assistive tech), so it never mounts DOM that a
 * screen reader or keyboard user could land on. Hues come from the
 * `--c-fx-*` tokens (index.css), which pick brighter/cooler values under
 * `.dark` — the light-mode gradient dimmed straight down reads as muddy on a
 * dark canvas, so dark mode gets its own opacity tuning too.
 */
export default function BackgroundFX() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* radial spotlight */}
      <div
        className="absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[820px] rounded-full blur-3xl opacity-40 dark:opacity-25"
        style={{ background: 'radial-gradient(50% 50% at 50% 50%, rgb(var(--c-fx-spot) / .8) 0%, rgb(var(--c-fx-spot) / 0) 70%)' }}
      />
      {/* diagonal ribbon */}
      <div
        className="absolute -right-40 top-32 h-64 w-[680px] rotate-[-35deg] blur-2xl opacity-30 dark:opacity-15"
        style={{ background: 'linear-gradient(90deg, rgb(var(--c-fx-ribbon-a) / .5), rgb(var(--c-fx-ribbon-b) / .5))' }}
      />
      {/* grid — already token-based via --c-fg, so it adapts automatically */}
      <div className="absolute inset-0 bg-grid" />
    </div>
  )
}
