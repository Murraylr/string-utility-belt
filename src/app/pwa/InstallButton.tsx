import React, { useSyncExternalStore } from 'react'
import { Download } from 'lucide-react'
import { canInstall, promptInstall, subscribeInstall } from './installPrompt'
import { track } from '@/app/analytics/analytics'

/**
 * "Install app" button, driven entirely by `beforeinstallprompt`: hidden
 * until the browser decides the app is installable, and hidden again once
 * it's installed or the prompt has been used.
 */
export default function InstallButton() {
  const available = useSyncExternalStore(subscribeInstall, canInstall, () => false)
  if (!available) return null

  return (
    <button type="button" className="btn h-[30px] px-2.5 text-[12.5px]" onClick={() => {
      void promptInstall().then(outcome => track('pwa_install_prompt', { outcome }))
    }}>
      <Download size={13} aria-hidden="true" />Install app
    </button>
  )
}
