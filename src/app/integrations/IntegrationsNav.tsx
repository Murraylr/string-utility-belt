import React from 'react'
import { usePref } from '@/app/prefs'
import { useT } from '@/app/i18n/useT'
import { countEvent } from '@/app/events/countEvent'
import { INTEGRATION_LINKS, INTEGRATIONS_SEEN_PREF, type IntegrationId } from './links'
import { INTEGRATION_ICONS as ICONS } from './icons'

// each link's accessible name (and hover title): the icon alone carries no text
const NAME = {
  chrome: 'integrations.chromeName',
  vscode: 'integrations.vscodeName',
  mcp: 'integrations.mcpName',
  cli: 'integrations.cliName',
} as const satisfies Record<IntegrationId, string>

/**
 * The header's "Get it for" group: the site's way into the browser and editor extensions,
 * MCP server and command-line tool. Brand marks only, each named on hover and to screen
 * readers; the lead-in from `md` up. A dot marks it as new until the visitor follows one of the
 * links or opens `/integrations/`. No looping animation: the header sits over the
 * pipeline editor.
 */
export default function IntegrationsNav() {
  const { t } = useT()
  const [seen, setSeen] = usePref(INTEGRATIONS_SEEN_PREF, false)

  return (
    <nav aria-label={t('integrations.label')} className="relative flex items-center gap-0.5 text-[12.5px] shrink-0">
      <span className="hidden md:inline text-muted pr-1.5 whitespace-nowrap">{t('integrations.lead')}</span>
      {INTEGRATION_LINKS.map(link => {
        const Icon = ICONS[link.id]
        const name = t(NAME[link.id])
        return (
          <a key={link.id} href={link.href} aria-label={name} title={name}
            {...(link.external ? { target: '_blank', rel: 'noopener' } : {})}
            onClick={() => {
              countEvent({ name: 'integration_click', integration: link.id, source: 'header' })
              setSeen(true)
            }}
            className="size-[30px] grid place-items-center rounded-md hover:bg-surface-2">
            <Icon size={15} className="shrink-0" />
          </a>
        )
      })}
      {!seen && (
        <span className="pointer-events-none absolute top-0.5 right-0 size-1.5 rounded-full bg-acc" data-testid="integrations-new">
          <span className="sr-only">{t('integrations.new')}</span>
        </span>
      )}
    </nav>
  )
}
