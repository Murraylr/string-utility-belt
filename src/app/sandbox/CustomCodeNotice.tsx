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
    // body text in `fg`: `warn` is for the icon only, too faint for running text at this size
    <div role="note" className="flex items-start gap-2 px-2.5 py-2 border rounded-md bg-surface-2 text-[12.5px] text-fg">
      <ShieldAlert size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-warn" />
      <span>
        This step runs JavaScript. Read the code before you turn it on, especially if it came from someone else&apos;s link.
        {' '}It runs in an isolated sandbox with no network access, but it sees this step&apos;s input.
        {!enabled && ' It stays off until you switch it on.'}
      </span>
    </div>
  )
}
