import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installBrowserSandbox } from '@/app/sandbox/browserSandbox'
import { registerSW } from '@/app/pwa/registerSW'
import { initAnalytics } from '@/app/analytics/analytics'
import './index.css'

// custom JavaScript steps run in a sandboxed iframe + worker; without this they refuse to run
installBrowserSandbox()
// offline support + update notifications (production only, never inside an embed iframe)
registerSW()
// Google Analytics: configured here, not in index.html, so page views carry sanitized URLs
initAnalytics()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
