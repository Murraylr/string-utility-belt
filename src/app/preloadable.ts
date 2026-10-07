import { createElement, lazy, useState, type ComponentType, type ReactElement } from 'react'

export interface PreloadableComponent<P extends object> {
  (props: P): ReactElement
  /** Fetches the component's chunk; resolves once it can render without suspending. */
  preload: () => Promise<void>
}

/**
 * `React.lazy` that can be fetched ahead of rendering. A route preloaded before
 * React mounts renders on its first pass instead of suspending, so a pre-rendered
 * page's static HTML is replaced by the finished page, not by a "Loading…" fallback.
 * Each mount keeps the form it started with: switching from the lazy wrapper to the
 * loaded component mid-life would remount the page and lose its state.
 */
export function preloadable<P extends object>(factory: () => Promise<{ default: ComponentType<P> }>): PreloadableComponent<P> {
  let loaded: ComponentType<P> | undefined
  let pending: Promise<void> | undefined
  const preload = () => (pending ??= factory().then(
    mod => { loaded = mod.default },
    error => { pending = undefined; throw error },
  ))
  const Lazy = lazy(() => preload().then(() => ({ default: loaded! })))
  function Preloaded(props: P) {
    const [direct] = useState(() => loaded !== undefined)
    return direct ? createElement(loaded!, props) : createElement(Lazy as unknown as ComponentType<P>, props)
  }
  Preloaded.preload = preload
  return Preloaded
}
