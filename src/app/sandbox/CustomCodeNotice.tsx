import React from 'react'
import { ShieldAlert } from 'lucide-react'
import { CODE_UTILITIES } from '@/app/share/trust'

/**
 * Shown on step cards whose utility runs user-authored code. Renders nothing for
 * any other utility, so it can be dropped into every card unconditionally.
 */
export default function CustomCodeNotice({ utilityId, enabled }: { utilityId: string; enabled: boolean }) {
  if (!CODE_UTILITIES.has(utilityId)) return null
  return (
    // body text in `fg`: light-mode `warn` on its own tint is ~3:1, too faint for text-xs
    <div role="note" className="flex items-start gap-2 text-xs text-fg bg-warn/10 border border-warn/40 rounded-xl p-2">
      <ShieldAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-warn" />
      <span>
        This step runs custom code — review it before enabling.
        {' '}It runs in an isolated sandbox with no network access, but it sees this step&apos;s input.
        {!enabled && ' It stays off until you switch it on.'}
      </span>
    </div>
  )
}
