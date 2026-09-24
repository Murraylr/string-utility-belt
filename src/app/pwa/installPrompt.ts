/**
 * Holds the deferred `beforeinstallprompt` event. The listener is attached
 * when this module is first imported (the entry chunk, before React mounts),
 * because browsers fire the event once, often before the header renders — a
 * listener added in a component effect can miss it and the button never shows.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export type InstallOutcome = 'accepted' | 'dismissed' | 'unavailable'

let deferred: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()

function set(next: BeforeInstallPromptEvent | null) {
  deferred = next
  for (const cb of [...listeners]) cb()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault() // keep the browser's own mini-infobar out of the way; the button offers it instead
    set(e as BeforeInstallPromptEvent)
  })
  window.addEventListener('appinstalled', () => set(null))
}

/** Whether the browser has offered an install that hasn't been used yet. */
export function canInstall(): boolean {
  return deferred !== null
}

/** Subscribe to install-availability changes (`useSyncExternalStore`-shaped). */
export function subscribeInstall(cb: () => void): () => void {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** Shows the browser's install prompt (call from a click). A prompt can be used only once. */
export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred
  if (!event) return 'unavailable'
  set(null)
  try {
    await event.prompt()
    return (await event.userChoice).outcome
  } catch {
    return 'dismissed'
  }
}

/** Test-only: forget any captured prompt. */
export function __resetForTests(): void {
  deferred = null
}
