import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installBrowserSandbox } from '@/app/sandbox/browserSandbox'
import { registerSW } from '@/app/pwa/registerSW'
import { getRoute } from '@/lib/router'
import { preloadRecipeRoute } from '@/app/pages/recipes/routes'
import './index.css'

// custom JavaScript steps run in a sandboxed iframe + worker; without this they refuse to run
installBrowserSandbox()
// offline support + update notifications (production only, never inside an embed iframe)
registerSW()

/**
 * Longest wait for a page's code and data before mounting anyway. Meanwhile the
 * pre-rendered HTML stays on screen, so a recipe page is replaced by the finished
 * page rather than by a "Loading…" state; past this the page loads as usual.
 */
const PRELOAD_CAP_MS = 2500

function mount() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

let cap: ReturnType<typeof setTimeout> | undefined
Promise.race([
  preloadRecipeRoute(getRoute()),
  new Promise(resolve => { cap = setTimeout(resolve, PRELOAD_CAP_MS) }),
])
  .catch(() => { /* a failed chunk shows its own error once mounted */ })
  .finally(() => {
    clearTimeout(cap)
    mount()
  })
