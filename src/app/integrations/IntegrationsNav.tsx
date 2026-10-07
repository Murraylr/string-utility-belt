import React from 'react'
import { SquareTerminal } from 'lucide-react'
import { usePref } from '@/app/prefs'
import { track } from '@/app/analytics/analytics'
import { useT } from '@/app/i18n/useT'
import { INTEGRATION_LINKS, INTEGRATIONS_SEEN_PREF, type IntegrationId } from './links'
import { ChromeIcon, McpIcon, VsCodeIcon } from './icons'

const ICONS: Record<IntegrationId, React.ComponentType<{ size?: number; className?: string }>> = {
  chrome: ChromeIcon,
  vscode: VsCodeIcon,
  mcp: McpIcon,
  cli: ({ size, className }) => <SquareTerminal size={size} className={className} aria-hidden="true" focusable="false" />,
}

// visible text, and the accessible name that starts with it (WCAG 2.5.3, label in name)
const TEXT = {
  chrome: { short: 'integrations.chrome', name: 'integrations.chromeName' },
  vscode: { short: 'integrations.vscode', name: 'integrations.vscodeName' },
  mcp: { short: 'integrations.mcp', name: 'integrations.mcpName' },
  cli: { short: 'integrations.cli', name: 'integrations.cliName' },
} as const satisfies Record<IntegrationId, { short: string; name: string }>

/**
 * The header's "Get it for Chrome · VS Code · MCP · CLI" group: the site's way into the
 * browser and editor extensions, MCP server and command-line tool. Brand marks always, their
 * names and the lead-in from `xl` up. A dot marks it as new until the visitor follows one of the
 * links or opens `/integrations/`. No looping animation: the header sits over the
 * pipeline editor.
 */
export default function IntegrationsNav() {
  const { t } = useT()
  const [seen, setSeen] = usePref(INTEGRATIONS_SEEN_PREF, false)

  return (
    <nav aria-label={t('integrations.label')}
      className="relative inline-flex items-center gap-0.5 rounded-full border border-primary-500/40 bg-primary-500/10 p-0.5 text-sm shadow-glow">
      <span className="hidden xl:inline px-2 text-xs font-medium text-primary-600 dark:text-primary-100">{t('integrations.lead')}</span>
      {INTEGRATION_LINKS.map(link => {
        const Icon = ICONS[link.id]
        const name = t(TEXT[link.id].name)
        return (
          <a key={link.id} href={link.href} aria-label={name} title={name}
            {...(link.external ? { target: '_blank', rel: 'noopener' } : {})}
            onClick={() => {
              track('integration_click', { integration: link.id })
              setSeen(true)
            }}
            className="inline-flex items-center justify-center gap-1 h-9 px-2 rounded-full font-medium hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <Icon size={16} className="shrink-0" />
            <span className="hidden xl:inline" aria-hidden="true">{t(TEXT[link.id].short)}</span>
          </a>
        )
      })}
      {!seen && (
        <span className="pointer-events-none absolute top-0 right-0 p-1 rounded-full bg-primary-600" data-testid="integrations-new">
          <span className="sr-only">{t('integrations.new')}</span>
        </span>
      )}
    </nav>
  )
}
